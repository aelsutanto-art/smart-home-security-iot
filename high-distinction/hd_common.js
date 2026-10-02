'use strict';
const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const execFile = promisify(require('child_process').execFile);
require('dotenv').config({quiet: true});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function runId(value) {
  if (!value || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw Error('Provide a run ID using letters, digits, underscores or hyphens.');
  return value;
}
function evidence(name) {
  const dir = path.join(__dirname, 'evidence'); fs.mkdirSync(dir, {recursive: true});
  const file = path.join(dir, name);
  const fd = fs.openSync(file, 'wx'); // Never replace evidence from another run.
  return record => fs.writeSync(fd, JSON.stringify(record) + '\n');
}
async function aws(args) {
  const {stdout} = await execFile(process.platform === 'win32' ? 'aws.exe' : 'aws',
    [...args, '--profile', 'school-lab', '--region', 'us-east-1', '--output', 'json', '--no-cli-pager'],
    {timeout: 45000, maxBuffer: 32 * 1024 * 1024, windowsHide: true});
  return JSON.parse(stdout);
}
module.exports = {sleep, runId, evidence, aws};
