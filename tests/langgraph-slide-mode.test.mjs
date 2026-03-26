import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('LangGraph article renders slide-mode markers in built HTML', () => {
  const html = readFileSync(
    join(
      process.cwd(),
      'dist/en/blog/langgraph-architecture-stateful-agent-orchestration-with-graphs/index.html'
    ),
    'utf8'
  );

  assert.match(html, /slide-deck/, 'expected slide deck wrapper in built HTML');
  assert.match(html, /data-slide=/, 'expected slide markers in built HTML');
  assert.match(html, /slide-nav/, 'expected slide navigation in built HTML');
});
