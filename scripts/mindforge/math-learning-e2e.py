#!/usr/bin/env python3
"""MindForge Math Learning: real Chromium, local static site, no remote service.
Run from repo root after: python -m pip install playwright && python -m playwright install chromium
"""
from __future__ import annotations
import functools, json, os, pathlib, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[2] / "public"
OUT=pathlib.Path(os.environ.get("MATH_E2E_OUTPUT","artifacts/math-learning"))
OUT.mkdir(parents=True,exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def overflow(page):
    return page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 1")

def current(page):
    return page.evaluate("""() => {
        const root=JSON.parse(localStorage.getItem('mf-math-learning-v1')||'{}');
        const s=root.session;
        return s ? {index:s.index,mode:s.mode,finished:s.finished,question:s.questions[s.index],score:s.score,mistakes:root.mistakes?.length||0} : null;
    }""")

def answer_for(page):
    return page.evaluate("""async () => {
        const s=JSON.parse(localStorage.getItem('mf-math-learning-v1')).session;
        const item=s.questions[s.index];
        const engine=await import('/mindforge/arcade/math/learning/engine.mjs');
        return engine.generateQuestion(item.topicId,{seed:item.seed,index:item.index,difficulty:item.difficulty}).answerSpec.value;
    }""")

def answer(page,value):
    page.locator('[data-answer="'+str(value)+'"]').click()
    page.locator('[data-action="check"]').click()

def check_question(page):
    page.goto(BASE+'/mindforge/arcade/math/practice/',wait_until='networkidle')
    page.locator('.hero h1').wait_for(timeout=15000)
    assert not overflow(page),'Overflow in Practice'
    assert page.locator('[data-topic]').count()==3,'Missing topics'
    page.locator('[data-action="theme"]').click()
    assert page.locator('html').get_attribute('data-theme')=='dark','Theme toggle broken'
    page.locator('[data-action="language"]').click()
    assert page.locator('html').get_attribute('lang') in ('en','vi'),'Language toggle broken'
    page.locator('[data-topic="compare-to-10"]').click()
    page.locator('#difficulty').select_option('normal')
    page.locator('[data-action="new"]').first.click()
    assert current(page)['question']['topicId']=='compare-to-10'
    assert page.locator('.mf-compare').count()==1
    assert not overflow(page),'Question overflow'
    page.screenshot(path=str(OUT/'practice-390.png'),full_page=True)
    page.locator('[data-action="auto"]').click() # off
    assert page.locator('[data-action="auto"]').get_attribute('aria-pressed')=='false'
    correct=answer_for(page)
    wrong=next(x for x in ('left','right','equal') if x!=correct)
    answer(page,wrong)
    assert current(page)['index']==0,'Wrong answer unexpectedly advanced'
    assert page.locator('.feedback.bad').count()==1,'Wrong-answer feedback missing'
    answer(page,wrong)
    assert page.locator('[data-action="next"]').is_enabled(),'Revealed answer should allow Next'
    assert current(page)['mistakes']==1,'Missed concept did not enter review queue'
    page.locator('[data-action="next"]').click()
    assert current(page)['index']==1
    page.reload(wait_until='networkidle')
    assert current(page)['index']==1,'Session did not survive reload'
    assert page.locator('[data-action="auto"]').get_attribute('aria-pressed')=='false'
    while current(page) and not current(page)['finished']:
        value=answer_for(page)
        answer(page,value)
        assert page.locator('.feedback.good').count()==1
        page.locator('[data-action="next"]').click()
    assert current(page)['finished'] is True
    assert page.locator('.completion').count()==1
    assert current(page)['mistakes']==1,'Other correct answers should not wipe unresolved mistakes'
    page.goto(BASE+'/mindforge/arcade/math/review/',wait_until='networkidle')
    page.locator('[data-action="new"]').click()
    review=current(page)
    assert review['mode']=='review','Review session not started'
    assert review['question']['topicId']=='compare-to-10'
    page.screenshot(path=str(OUT/'review-390.png'),full_page=True)
    answer(page,answer_for(page))
    assert current(page)['mistakes']==0,'Correct review failed to resolve missed concept'
    page.locator('[data-action="next"]').click()
    assert current(page)['finished'] is True
    page.reload(wait_until='networkidle')
    assert current(page)['finished'] is True,'Review completion not persisted'
    assert not overflow(page),'Review page overflow'

def run():
    global BASE
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    BASE='http://127.0.0.1:'+str(server.server_address[1])
    try:
        with sync_playwright() as playwright:
            browser=playwright.chromium.launch(headless=True,args=['--no-sandbox'])
            for width in (280,320,390,768,1280):
                ctx=browser.new_context(viewport={'width':width,'height':840},has_touch=True,is_mobile=width<=390)
                page=ctx.new_page()
                problems=[]
                page.on('pageerror',lambda error:problems.append(str(error)))
                for route in ('practice','review'):
                    page.goto(BASE+'/mindforge/arcade/math/'+route+'/',wait_until='networkidle')
                    page.locator('.hero h1').wait_for(timeout=10000)
                    assert not overflow(page),f'{route} horizontal overflow at {width}px'
                    assert not problems,f'{route} errors at {width}px: {problems}'
                page.screenshot(path=str(OUT/f'practice-{width}.png'),full_page=True)
                if width==390:
                    check_question(page)
                    assert not problems,f'Browser errors: {problems}'
                print('PASS viewport',width,'practice/review')
                ctx.close()
            browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':run()
