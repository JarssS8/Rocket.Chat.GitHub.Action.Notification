"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const utils_1 = require("./utils");
const rocketchat_1 = require("./rocketchat");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const status = (0, utils_1.validateStatus)(core.getInput('type', { required: true }).toLowerCase());
            const jobName = core.getInput('job_name', { required: true });
            const url = process.env.ROCKETCHAT_WEBHOOK || core.getInput('url');
            const githubUrl = process.env.GITHUB_URL || core.getInput('github_url');
            let mention = core.getInput('mention');
            let mentionCondition = core.getInput('mention_if').toLowerCase();
            const options = {
                username: core.getInput('username'),
                channel: core.getInput('channel'),
                icon_emoji: core.getInput('icon_emoji')
            };
            const commitFlag = core.getInput('commit') === 'true';
            const token = core.getInput('token');
            const additionalURL = core.getInput('additional_url') === 'true';
            const additionalURLName = core.getInput('additional_url_name');
            const additionalURLValue = core.getInput('additional_url_value');
            if (mention && !(0, utils_1.isValidCondition)(mentionCondition)) {
                mention = '';
                mentionCondition = '';
                console.warn(`
				Ignore Rocket.Chat message mention:
				mention_if: ${mentionCondition} is invalid
			`);
            }
            if (url === '') {
                throw new Error(`
				[Error] Missing Rocket.Chat Incoming Webhooks URL.
				Please configure "ROCKETCHAT_WEBHOOK" as environment variable or
				specify the key called "url" in "with" section.
			`);
            }
            const rocketchat = new rocketchat_1.RocketChat();
            const payload = yield rocketchat.generatePayload(jobName, status, mention, mentionCondition, commitFlag, githubUrl, additionalURL, token, additionalURLName, additionalURLValue);
            yield rocketchat.notify(url, options, payload);
            console.info('Sent message to Rocket.Chat');
        }
        catch (err) {
            core.setFailed(err.message);
        }
    });
}
run();
