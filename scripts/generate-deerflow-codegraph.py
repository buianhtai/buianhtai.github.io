#!/usr/bin/env python3
"""Generate a source-derived, version-pinned DeerFlow code graph using Python's AST.

Run: python3 scripts/generate-deerflow-codegraph.py
     python3 scripts/generate-deerflow-codegraph.py --self-test
     python3 scripts/generate-deerflow-codegraph.py --source-root /path/to/deer-flow

Static analysis has limits: dynamic dispatch, dependency injection, decorators,
Python reflection and third-party calls cannot be conclusively resolved.
Generated edges therefore record resolution confidence and an exact call site.
"""
from __future__ import annotations

import argparse
import ast
import datetime as dt
import json
import pathlib
import re
import sys
import urllib.request
from collections import Counter, defaultdict

REVISION = "1f15e0b43ca58b9601514f9f5c408fb032022833"
FILES = (
    "backend/app/gateway/routers/thread_runs.py",
    "backend/app/gateway/services.py",
    "backend/packages/harness/deerflow/runtime/runs/manager.py",
    "backend/packages/harness/deerflow/runtime/runs/worker.py",
    "backend/packages/harness/deerflow/runtime/stream_bridge/base.py",
    "backend/packages/harness/deerflow/runtime/runs/schemas.py",
    "backend/packages/harness/deerflow/runtime/runs/store/base.py",
)
ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "deerflow-code-source" / REVISION
OUTPUT = ROOT / "public" / "data" / "deerflow-codegraph.generated.json"


def module_name(path: str) -> str:
    if path.startswith("backend/app/"):
        return "app." + path[len("backend/app/") : -3].replace("/", ".")
    return "deerflow." + path.split("/deerflow/", 1)[1][:-3].replace("/", ".")


def source_for(path: str, source_root: pathlib.Path | None) -> str:
    if source_root:
        source_file = source_root / path
        if not source_file.is_file():
            raise FileNotFoundError(f"Expected upstream source: {source_file}")
        return source_file.read_text(encoding="utf-8")
    target = CACHE / path
    if target.is_file():
        return target.read_text(encoding="utf-8")
    url = f"https://raw.githubusercontent.com/bytedance/deer-flow/{REVISION}/{path}"
    req = urllib.request.Request(url, headers={"User-Agent": "deerflow-codegraph-source-parser"})
    with urllib.request.urlopen(req, timeout=35) as response:
        body = response.read().decode("utf-8")
    ast.parse(body, filename=path)  # Reject wrong or malformed upstream response.
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body, encoding="utf-8")
    return body


def expression(node: ast.AST | None, limit: int = 115) -> str:
    if node is None:
        return ""
    try:
        text = ast.unparse(node)
    except (ValueError, TypeError, RecursionError):
        return node.__class__.__name__
    return re.sub(r"\s+", " ", text)[:limit]


def name_of_call(func: ast.AST) -> str:
    return expression(func, 140)


def signature(node: ast.FunctionDef | ast.AsyncFunctionDef, lines: list[str]) -> str:
    # Use AST so signatures spanning multiple lines are still complete.
    args = node.args
    try:
        a = ast.unparse(args)
    except Exception:
        a = "(...)"
    suffix = " -> " + expression(node.returns, 130) if node.returns else ""
    return ("async def " if isinstance(node, ast.AsyncFunctionDef) else "def ") + node.name + "(" + a + ")" + suffix


def parse_file(path: str, body: str):
    module = module_name(path)
    lines = body.splitlines()
    root = ast.parse(body, filename=path, type_comments=True)
    symbols: list[dict] = []
    calls: list[dict] = []
    imports: list[dict] = []
    bases: list[dict] = []
    branches: list[dict] = []

    class Walk(ast.NodeVisitor):
        def __init__(self):
            self.parents: list[tuple[str, str]] = []
            self.current: str | None = None

        def visit_Import(self, node):
            for alias in node.names:
                imports.append({"module": alias.name, "alias": alias.asname or alias.name.split(".")[0], "kind": "import", "line": node.lineno})

        def visit_ImportFrom(self, node):
            if node.level:  # Relative import resolution, relative to current package.
                parts = module.split(".")[:-node.level]
                imported_module = ".".join(parts + ([node.module] if node.module else []))
            else:
                imported_module = node.module or ""
            for alias in node.names:
                imports.append({"module": imported_module, "name": alias.name, "alias": alias.asname or alias.name, "kind": "from", "line": node.lineno})

        def visit_ClassDef(self, node):
            qual = ".".join([name for name, _ in self.parents] + [node.name])
            sid = f"{module}:{qual}"
            enclosing = self.parents[-1][0] if self.parents else None
            symbols.append({"id": sid, "name": node.name, "qualname": qual, "module": module,
                            "path": path, "line": node.lineno, "endLine": node.end_lineno or node.lineno,
                            "kind": "class", "parent": enclosing, "signature": "class " + node.name + "(" + ", ".join(expression(b) for b in node.bases) + ")",
                            "doc": (ast.get_docstring(node) or "")[:330], "excerpt": "\n".join(lines[node.lineno - 1 : min(node.lineno + 17, len(lines))])})
            for base in node.bases:
                bases.append({"from": sid, "base": expression(base), "line": node.lineno})
            self.parents.append((node.name, "class"))
            # Visit methods and nested classes, but not class-level calls as function calls.
            for sub in node.body:
                if isinstance(sub, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    self.visit(sub)
            self.parents.pop()

        def visit_FunctionDef(self, node):
            self.function(node, False)

        def visit_AsyncFunctionDef(self, node):
            self.function(node, True)

        def function(self, node, async_):
            qual = ".".join([name for name, _ in self.parents] + [node.name])
            sid = f"{module}:{qual}"
            prev = self.current
            parent = ".".join(x for x, _ in self.parents) if self.parents else None
            kind = "method" if self.parents and self.parents[-1][1] == "class" else "function"
            symbols.append({"id": sid, "name": node.name, "qualname": qual, "module": module,
                            "path": path, "line": node.lineno, "endLine": node.end_lineno or node.lineno,
                            "kind": kind, "async": async_, "parent": parent,
                            "signature": signature(node, lines),
                            "doc": (ast.get_docstring(node) or "")[:330],
                            "excerpt": "\n".join(lines[node.lineno - 1 : min(node.lineno + 24, len(lines))])})
            self.current = sid
            self.parents.append((node.name, "function"))
            # Traverse only this function's scope; avoid attributing nested def calls
            # to the outer function. Capture their definitions independently.
            for sub in node.body:
                self.visit(sub)
            self.parents.pop()
            self.current = prev

        def visit_Call(self, node):
            if self.current:
                calls.append({"from": self.current, "expression": name_of_call(node.func),
                              "line": node.lineno, "awaited": False, "kind": "call"})
            self.generic_visit(node)

        def visit_Await(self, node):
            # Mark the awaited call at the exact callsite after visit_Call records it.
            if isinstance(node.value, ast.Call) and self.current:
                target = name_of_call(node.value.func)
                self.visit(node.value)
                for call in reversed(calls):
                    if call["from"] == self.current and call["line"] == node.value.lineno and call["expression"] == target:
                        call["awaited"] = True
                        break
                return
            self.generic_visit(node)

        def branch(self, node, kind, condition=None):
            if self.current:
                branches.append({"owner": self.current, "kind": kind, "line": node.lineno,
                                 "condition": expression(condition, 155) if condition else ""})

        def visit_If(self, node):
            self.branch(node, "if", node.test)
            self.generic_visit(node)

        def visit_IfExp(self, node):
            self.branch(node, "conditional-expression", node.test)
            self.generic_visit(node)

        def visit_Try(self, node):
            self.branch(node, "try")
            self.generic_visit(node)

        def visit_TryStar(self, node):
            self.branch(node, "try-star")
            self.generic_visit(node)

        def visit_ExceptHandler(self, node):
            self.branch(node, "except", node.type)
            self.generic_visit(node)

        def visit_Raise(self, node):
            self.branch(node, "raise", node.exc)
            self.generic_visit(node)

        def visit_While(self, node):
            self.branch(node, "while", node.test)
            self.generic_visit(node)

        def visit_For(self, node):
            self.branch(node, "for", node.iter)
            self.generic_visit(node)

        def visit_AsyncFor(self, node):
            self.branch(node, "async-for", node.iter)
            self.generic_visit(node)

        def visit_Match(self, node):
            self.branch(node, "match", node.subject)
            self.generic_visit(node)

        def visit_Return(self, node):
            self.branch(node, "return", node.value)
            self.generic_visit(node)

        def visit_With(self, node):
            self.branch(node, "with")
            self.generic_visit(node)

        def visit_AsyncWith(self, node):
            self.branch(node, "async-with")
            self.generic_visit(node)

    Walk().visit(root)
    return {"path": path, "module": module, "lines": len(lines), "symbols": symbols,
            "calls": calls, "imports": imports, "bases": bases, "branches": branches}


def resolve(source_files: list[dict]) -> dict:
    symbols = [s for f in source_files for s in f["symbols"]]
    index = {s["id"]: s for s in symbols}
    methods_by_name: dict[str, list[dict]] = defaultdict(list)
    for sym in symbols:
        methods_by_name[sym["name"]].append(sym)
    imports_by_module = {f["module"]: f["imports"] for f in source_files}
    relations = []
    for f in source_files:
        mod = f["module"]
        visible_imports = {i["alias"]: i for i in imports_by_module[mod]}
        for call in f["calls"]:
            expr = call["expression"]
            source = index[call["from"]]
            target = None
            confidence = "unresolved"
            if re.match(r"^[A-Za-z_]\w*$", expr):
                local = f"{mod}:{expr}"
                if local in index:
                    target, confidence = local, "resolved"
                elif expr in visible_imports:
                    imp = visible_imports[expr]
                    if imp["kind"] == "from":
                        candidate = f"{imp['module']}:{imp['name']}"
                        if candidate in index:
                            target, confidence = candidate, "resolved-import"
            elif expr.startswith("self."):
                meth = expr.split(".", 1)[1]
                nearest_class = source["qualname"].split(".")[0]
                candidate = f"{mod}:{nearest_class}.{meth}"
                if candidate in index and source["kind"] == "method":
                    target, confidence = candidate, "resolved-self"
            elif "." in expr:
                root, _, name = expr.rpartition(".")
                imp = visible_imports.get(root)
                if imp and imp["kind"] == "import":
                    candidate = f"{imp['module']}:{name}"
                    if candidate in index:
                        target, confidence = candidate, "resolved-import"
                # A unique method name is a *candidate*, not a confirmed binding.
                # e.g. run_mgr.create_or_reject(), bridge.publish().
                if not target and re.match(r"^[A-Za-z_]\w*\.[A-Za-z_]\w*$", expr):
                    candidates = [s for s in methods_by_name[name] if s["kind"] == "method"]
                    if len(candidates) == 1:
                        target, confidence = candidates[0]["id"], "candidate"
            if target == call["from"]:
                confidence = "recursive"
            relations.append({"from": call["from"], "to": target, "expression": expr,
                              "path": f["path"], "line": call["line"], "awaited": call["awaited"],
                              "confidence": confidence, "kind": "call"})
    for f in source_files:
        for base in f["bases"]:
            relations.append({"from": base["from"], "to": None, "expression": base["base"],
                              "path": f["path"], "line": base["line"], "awaited": False,
                              "confidence": "base-expression", "kind": "inherits"})
    branch_list = [b for f in source_files for b in f["branches"]]
    counts = Counter(r["confidence"] for r in relations if r["kind"] == "call")
    return {"revision": REVISION, "generator": "python-stdlib-ast-v1",
            "files": [{"path": f["path"], "module": f["module"], "lines": f["lines"], "imports": f["imports"]} for f in source_files],
            "symbols": symbols, "relations": relations, "branches": branch_list,
            "stats": {"files": len(source_files), "symbols": len(symbols),
                      "calls": sum(counts.values()), "resolved": sum(counts[k] for k in ("resolved", "resolved-import", "resolved-self", "recursive")),
                      "candidates": counts["candidate"], "unresolved": counts["unresolved"],
                      "branches": len(branch_list)}}


def self_test():
    sample = """
from pkg.other import other
class Counter:
    def tick(self, n):
        if n > 0:
            return self.inc(n)
        return other(n)
    def inc(self, n):
        return n + 1
async def go():
    c = Counter()
    return await other(1)
"""
    f = parse_file("backend/app/gateway/services.py", sample)
    out = resolve([f])
    assert any(s["name"] == "tick" and s["kind"] == "method" for s in out["symbols"])
    assert any(r["expression"] == "self.inc" and r["confidence"] == "resolved-self" for r in out["relations"])
    assert any(b["condition"] == "n > 0" for b in out["branches"])
    assert out["stats"]["symbols"] == 4
    print("AST symbol, class-method call, await and branch self-test passed")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source-root", type=pathlib.Path, default=None)
    p.add_argument("--out", type=pathlib.Path, default=OUTPUT)
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()
    if args.self_test:
        self_test()
        return
    parsed = []
    for path in FILES:
        source = source_for(path, args.source_root)
        item = parse_file(path, source)
        parsed.append(item)
        print(f"Parsed {path}: {len(item['symbols'])} symbols, {len(item['calls'])} calls")
    result = resolve(parsed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {args.out} :: {result['stats']}")


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        print(f"DeerFlow AST generation failed: {ex}", file=sys.stderr)
        raise
