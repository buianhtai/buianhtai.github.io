#!/usr/bin/env python3
"""Generate structural code control-flow and mutation diagrams for pinned DeerFlow.

Only source-backed Python AST statements are represented. TRY handler arrows
mean "possible handler entry", not an exact Python exception dispatch CFG.
Assignment is not evidence of persistence; external effects are call heuristics.
"""
from __future__ import annotations

import ast
import importlib.util
import json
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve()
modspec = importlib.util.spec_from_file_location("deerflow_codegraph", HERE.with_name("generate-deerflow-codegraph.py"))
codegraph = importlib.util.module_from_spec(modspec)
modspec.loader.exec_module(codegraph)

REQUIRED = {
    "stream_run", "start_run", "sse_consumer", "run_agent",
    "_stream_once", "create_or_reject", "_admit_thread_operation",
    "try_start", "format_sse", "subscribe", "publish",
}
OUT = codegraph.ROOT / "public/data/deerflow-controlflow.generated.json"
CALL_HINTS = {
    "event": ("publish", "publish_end", "emit", "send", "yield"),
    "persistence-candidate": ("commit", "flush", "save", "persist", "insert", "upsert", "update_status", "execute", "delete", "create_or_reject"),
    "concurrency": ("create_task", "cancel", "acquire", "release", "try_start"),
    "mutation-candidate": ("append", "extend", "update", "pop", "setdefault", "clear", "setattr", "add", "discard"),
}


def expr(node, max_length=124):
    return codegraph.expression(node, max_length)


def mutations(statement, path):
    """Find syntactic writes and effectful-looking calls in one AST statement.

    Prevent scanning nested body statements, which own their own flow nodes.
    """
    found = []
    class Visit(ast.NodeVisitor):
        def visit_FunctionDef(self, n): return
        def visit_AsyncFunctionDef(self, n): return
        def visit_ClassDef(self, n): return
        def visit_If(self, n): self.visit(n.test)
        def visit_For(self, n): self.visit(n.target); self.visit(n.iter)
        def visit_AsyncFor(self, n): self.visit(n.target); self.visit(n.iter)
        def visit_While(self, n): self.visit(n.test)
        def visit_Try(self, n): return
        def visit_With(self, n):
            for x in n.items: self.visit(x.context_expr)
        def visit_AsyncWith(self, n):
            for x in n.items: self.visit(x.context_expr)
        def visit_ExceptHandler(self, n): return
        def visit_Match(self, n): self.visit(n.subject)

        def record(self, kind, target, n, evidence):
            found.append({"kind":kind,"target":target,"line":n.lineno,"path":path,
                          "evidence":evidence,"certainty":"syntactic" if kind in ("attribute-write","container-write","local-binding") else "heuristic"})
        def record_target(self, target, n, value=""):
            if isinstance(target, (ast.Tuple, ast.List)):
                for el in target.elts: self.record_target(el,n,value)
                return
            name=expr(target)
            kind = "attribute-write" if isinstance(target, ast.Attribute) else "container-write" if isinstance(target, ast.Subscript) else "local-binding"
            self.record(kind,name,n,(name+" = "+value).strip())
        def visit_Assign(self, n):
            for target in n.targets:self.record_target(target,n,expr(n.value,100))
            self.visit(n.value)
        def visit_AnnAssign(self, n):
            self.record_target(n.target,n,expr(n.value,100))
            if n.value:self.visit(n.value)
        def visit_AugAssign(self,n):
            self.record_target(n.target,n,expr(n.value,100))
            self.visit(n.value)
        def visit_NamedExpr(self,n):
            self.record_target(n.target,n,expr(n.value,100))
            self.visit(n.value)
        def visit_Call(self,n):
            name=expr(n.func,100)
            tail=name.rsplit(".",1)[-1]
            for kind, endings in CALL_HINTS.items():
                if tail in endings:
                    self.record(kind,name,n,name+"(...)")
                    break
            self.generic_visit(n)
    Visit().visit(statement)
    # remove exact duplicate effect observations
    distinct={(m["kind"],m["target"],m["line"]):m for m in found}
    return list(distinct.values())


class Flow:
    """Structural branch graph, not Python bytecode-accurate CFG."""

    def __init__(self, source, path):
        self.source=source.splitlines()
        self.path=path
        self.nodes=[]
        self.edges=[]
        self.effects=[]
        self.num=0

    def node(self, stmt, kind=None, label=None, depth=0):
        self.num+=1
        ident="n"+str(self.num)
        label=label or expr(stmt,150)
        kind=kind or type(stmt).__name__.lower()
        line=getattr(stmt,"lineno",0)
        self.nodes.append({"id":ident,"kind":kind,"label":label[:165],"line":line,
                           "depth":depth,"path":self.path,
                           "excerpt":"\n".join(self.source[max(0,line-1):min(line+4,len(self.source))])})
        if kind not in ("entry","end","handler"):
            for m in mutations(stmt,self.path):
                m["node"]=ident
                self.effects.append(m)
        return ident

    def link(self, frm, to, relation="next"):
        if frm and to and (frm,to,relation) not in self._edge_set:
            self.edges.append({"from":frm,"to":to,"kind":relation})
            self._edge_set.add((frm,to,relation))

    def build(self, func):
        self._edge_set=set()
        end=self.node(func,"end","EXIT",0)
        first=self.block(func.body,end,0,None,end)
        start=self.node(func,"entry",func.name+"() / ENTRY",0)
        self.link(start,first)
        self.nodes.sort(key=lambda n:(n["line"], 0 if n["kind"]=="entry" else 2 if n["kind"]=="end" else 1,n["id"]))
        # Preserve order in generated layout but always include the synthetic EXIT node.
        return {"nodes":self.nodes,"edges":self.edges,"effects":sorted(self.effects,key=lambda m:m["line"]),
                "caveat":"Structural AST approximation. Except edges are possible handlers, not exact exception propagation. Finally control transfer and runtime dispatch may differ."}

    def block(self, statements, following, depth=0, loop_header=None, break_target=None):
        target=following
        # reverse construction permits reliable next edges through nested blocks
        for st in reversed(statements):
            if isinstance(st,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):
                continue
            if isinstance(st,ast.If):
                n=self.node(st,"if","if "+expr(st.test),depth)
                yes=self.block(st.body,target,depth+1,loop_header,break_target)
                no=self.block(st.orelse,target,depth+1,loop_header,break_target) if st.orelse else target
                self.link(n,yes,"true");self.link(n,no,"false")
            elif isinstance(st,(ast.While,ast.For,ast.AsyncFor)):
                title=("while "+expr(st.test)) if isinstance(st,ast.While) else ("async for " if isinstance(st,ast.AsyncFor) else "for ")+expr(st.target,55)+" in "+expr(st.iter,75)
                n=self.node(st,"loop",title,depth)
                after=self.block(st.orelse,target,depth+1,loop_header,break_target) if st.orelse else target
                first=self.block(st.body,n,depth+1,n,target)
                self.link(n,first,"iteration");self.link(n,after,"done")
            elif isinstance(st,(ast.Try,ast.TryStar)):
                n=self.node(st,"try","try / possible exception handlers",depth)
                after_finally=self.block(st.finalbody,target,depth+1,loop_header,break_target) if st.finalbody else target
                after_normal=self.block(st.orelse,after_finally,depth+1,loop_header,break_target) if st.orelse else after_finally
                normal=self.block(st.body,after_normal,depth+1,loop_header,break_target)
                self.link(n,normal,"normal")
                for handler in st.handlers:
                    h=self.node(handler,"handler","except "+expr(handler.type) if handler.type else "except",depth+1)
                    handled=self.block(handler.body,after_finally,depth+2,loop_header,break_target)
                    self.link(n,h,"possible exception");self.link(h,handled,"handle")
            elif isinstance(st,(ast.With,ast.AsyncWith)):
                n=self.node(st,"with","async with" if isinstance(st,ast.AsyncWith) else "with",depth)
                start=self.block(st.body,target,depth+1,loop_header,break_target)
                self.link(n,start,"body")
            elif isinstance(st,ast.Match):
                n=self.node(st,"match","match "+expr(st.subject),depth)
                for i,case in enumerate(st.cases):
                    start=self.block(case.body,target,depth+1,loop_header,break_target)
                    self.link(n,start,"case "+str(i+1))
                self.link(n,target,"other / fallback")
            else:
                kind=("raise" if isinstance(st,ast.Raise) else
                      "return" if isinstance(st,ast.Return) else
                      "break" if isinstance(st,ast.Break) else
                      "continue" if isinstance(st,ast.Continue) else
                      "write" if isinstance(st,(ast.Assign,ast.AnnAssign,ast.AugAssign)) else
                      "action")
                n=self.node(st,kind,expr(st,125),depth)
                if kind in ("return","raise"):
                    self.link(n,self.exit,"exit" if kind=="return" else "raises")
                elif kind=="break":
                    self.link(n,break_target or following,"break")
                elif kind=="continue":
                    self.link(n,loop_header or following,"continue")
                else:
                    self.link(n,target)
            target=n
        return target

    @property
    def exit(self):
        for n in self.nodes:
            if n["kind"]=="end":return n["id"]
        return None


def extract(root, path):
    flows={}
    def visit(n,prefix=""):
        if isinstance(n,ast.ClassDef):
            name=prefix+n.name
            for ch in n.body:
                if isinstance(ch,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):
                    visit(ch,name+".")
        elif isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)):
            name=prefix+n.name
            if n.name in REQUIRED:
                flow=Flow(source,path)
                data=flow.build(n)
                flows[f"{codegraph.module_name(path)}:{name}"]={"name":name,"path":path,"line":n.lineno,"endLine":n.end_lineno,**data}
            for ch in n.body:
                if isinstance(ch,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):
                    visit(ch,name+".")
            # Nested definitions may occur within try/if scopes; locate without stepping into their function bodies.
            for ch in ast.walk(n):
                if isinstance(ch,(ast.FunctionDef,ast.AsyncFunctionDef)) and ch is not n and ch.name in REQUIRED:
                    nested=prefix+name.split(".")[-1]+"."+ch.name
                    key=f"{codegraph.module_name(path)}:{nested}"
                    if key not in flows:
                        flow=Flow(source,path)
                        flows[key]={"name":nested,"path":path,"line":ch.lineno,"endLine":ch.end_lineno,**flow.build(ch)}
        elif isinstance(n,ast.Module):
            for ch in n.body:
                if isinstance(ch,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):visit(ch)
    source=root._source
    visit(root)
    return flows


def generate():
    result={}
    for path in codegraph.FILES:
        source=codegraph.source_for(path,None)
        tree=ast.parse(source,filename=path)
        tree._source=source
        result.update(extract(tree,path))
    return {"revision":codegraph.REVISION,"generator":"ast-structural-flow-v1",
            "flows":result,"stats":{"functions":len(result),"nodes":sum(len(v["nodes"]) for v in result.values()),
                                  "edges":sum(len(v["edges"]) for v in result.values()),
                                  "effects":sum(len(v["effects"]) for v in result.values())}}


def test():
    src="""async def demo(rec, obj):
    rec.status = "running"
    if rec.ready:
        await obj.publish("event")
    else:
        raise RuntimeError("bad")
    for item in rec.items:
        if item.skip: continue
        rec.count += 1
    try:
        rec.done = True
    except ValueError:
        rec.done = False
    return rec
"""
    f=Flow(src,"test.py")
    node=ast.parse(src).body[0]
    graph=f.build(node)
    kinds=Counter(x["kind"] for x in graph["edges"])
    assert kinds["true"] and kinds["false"] and kinds["iteration"] and kinds["done"] and kinds["possible exception"]
    assert any(m["kind"]=="attribute-write" and m["target"]=="rec.status" for m in graph["effects"])
    assert any(m["kind"]=="event" and m["target"]=="obj.publish" for m in graph["effects"])
    assert any(e["kind"]=="raises" for e in graph["edges"])
    assert any(e["kind"]=="continue" for e in graph["edges"])
    print("Control-flow and effect extraction tests passed")


if __name__=="__main__":
    test()
    result=generate()
    assert result["stats"]["functions"]>=8
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
    print("Generated",OUT,result["stats"])
