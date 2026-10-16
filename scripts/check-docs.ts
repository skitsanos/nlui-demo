import {resolve} from 'node:path';
import {verifyDocumentation} from '../src/docs/documentation.ts';

const issues = verifyDocumentation(resolve(import.meta.dir, '..'));
console.log(JSON.stringify({passed: issues.length === 0, issues}));
if (issues.length) process.exitCode = 1;
