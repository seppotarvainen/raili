"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const init_1 = require("../src/init");
describe('initCommand', () => {
    let tmpdir;
    beforeEach(() => {
        tmpdir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'raili-test-'));
    });
    afterEach(() => {
        // remove tmpdir recursively
        fs_1.default.rmSync(tmpdir, { recursive: true, force: true });
    });
    test('creates .raili with template files', async () => {
        await (0, init_1.initCommand)(tmpdir);
        const railiDir = path_1.default.join(tmpdir, '.raili');
        expect(fs_1.default.existsSync(railiDir)).toBe(true);
        expect(fs_1.default.existsSync(path_1.default.join(railiDir, 'workflow.yaml'))).toBe(true);
        expect(fs_1.default.existsSync(path_1.default.join(railiDir, 'agent-registry.json'))).toBe(true);
        expect(fs_1.default.existsSync(path_1.default.join(railiDir, 'script-registry.json'))).toBe(true);
    });
    test('fails if .raili already exists', async () => {
        const railiDir = path_1.default.join(tmpdir, '.raili');
        fs_1.default.mkdirSync(railiDir);
        await expect((0, init_1.initCommand)(tmpdir)).rejects.toThrow('.raili/ already exists');
    });
});
