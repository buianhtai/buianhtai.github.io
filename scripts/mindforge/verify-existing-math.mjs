#!/usr/bin/env node
/**
 * Lightweight Math Quest smoke checks (no browser or npm install required).
 * Supplements math-content.test.mjs; NOT a replacement for Playwright QA.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../../',import.meta.url));
const html=readFileSync(root+'public/mindforge/arcade/math/index.html','utf8');
const scripts=[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.ok(scripts.length>0,'Math Quest inline game script missing');
for(let i=0;i<scripts.length;i++)new Script(scripts[i],{filename:'math-quest-inline-'+i+'.js'});
for(const required of [
  'function question(kind,level)',
  'function createQuestion()',
  'function check()',
  'function next()',
  'function scheduleAuto()',
  'function restore()',
  'mf-math-quest-v1',
  'mf-library-theme'
]) assert.ok(html.includes(required),'Existing game regression: missing '+required);
const pages=[
 'public/mindforge/index.html',
 'public/mindforge/games/index.html',
 'public/mindforge/arcade/index.html',
 'public/mindforge/arcade/math/index.html'
];
for(const p of pages){const body=readFileSync(root+p,'utf8');assert.ok(body.length>1000,'Missing route '+p);}
console.log('PASS: Math Quest script parses; existing modes, Auto Next and four MindForge routes are present.');
