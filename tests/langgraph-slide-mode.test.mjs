import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('LangGraph article renders the custom hero infographic in built HTML', () => {
  const html = readFileSync(
    join(
      process.cwd(),
      'dist/en/blog/langgraph-architecture-stateful-agent-orchestration-with-graphs/index.html'
    ),
    'utf8'
  );

  assert.match(html, /langgraph-hero/, 'expected custom hero wrapper in built HTML');
  assert.match(html, /langgraph-state-capsule/, 'expected animated state capsule in built HTML');
  assert.match(html, /langgraph-callout--durability/, 'expected durability callout in built HTML');
  assert.match(html, /langgraph-yard-section/, 'expected article-specific poster section wrapper in built HTML');
  assert.match(html, /CONTROL PANELS/, 'expected control panel poster section in built HTML');
  assert.doesNotMatch(html, /slide-nav/, 'did not expect slide navigation in built HTML');
});
