"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const run_1 = require("../src/run");
describe('runCommand', () => {
    let tmpdir;
    beforeEach(() => {
        tmpdir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'raili-test-'));
    });
    afterEach(() => {
        fs_1.default.rmSync(tmpdir, { recursive: true, force: true });
    });
    test('fails if .raili missing', async () => {
        await expect((0, run_1.runCommand)(tmpdir)).rejects.toThrow('.raili/ directory not found');
    });
    test('fails if registries missing or invalid', async () => {
        const railiDir = path_1.default.join(tmpdir, '.raili');
        fs_1.default.mkdirSync(railiDir);
        await expect((0, run_1.runCommand)(tmpdir)).rejects.toThrow('agent-registry.json not found');
        fs_1.default.writeFileSync(path_1.default.join(railiDir, 'agent-registry.json'), 'not json');
        fs_1.default.writeFileSync(path_1.default.join(railiDir, 'script-registry.json'), 'not json');
        await expect((0, run_1.runCommand)(tmpdir)).rejects.toThrow('Invalid JSON');
    });
    test('returns parsed registries when valid', async () => {
        const railiDir = path_1.default.join(tmpdir, '.raili');
        fs_1.default.mkdirSync(railiDir);
        fs_1.default.writeFileSync(path_1.default.join(railiDir, 'agent-registry.json'), JSON.stringify({ a: { path: './x' } }));
        fs_1.default.writeFileSync(path_1.default.join(railiDir, 'script-registry.json'), JSON.stringify({ s: './y' }));
        const res = await (0, run_1.runCommand)(tmpdir);
        expect(res.agents).toEqual({ a: { path: './x' } });
        expect(res.scripts).toEqual({ s: './y' });
    });
});
