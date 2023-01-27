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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RocketChat = void 0;
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
const axios_1 = __importDefault(require("axios"));
class Helper {
    constructor() {
        this.context = github.context;
    }
    get success() {
        return {
            color: '#2cbe4e',
            result: 'Succeeded'
        };
    }
    get failure() {
        return {
            color: '#cb2431',
            result: 'Failed'
        };
    }
    get cancelled() {
        return {
            color: '#ffc107',
            result: 'Cancelled'
        };
    }
    get isPullRequest() {
        const { eventName } = this.context;
        return eventName === 'pull_request';
    }
    get baseFields() {
        const { sha, eventName } = this.context;
        const { owner, repo } = this.context.repo;
        const { number } = this.context.issue;
        const githubUrl = process.env.GITHUB_URL || core.getInput('github_url') || 'https://github.com';
        const repoUrl = `${githubUrl}/${owner}/${repo}`;
        let actionUrl = repoUrl;
        let eventUrl = eventName;
        if (this.isPullRequest) {
            eventUrl = `[${eventName}](${repoUrl}/pull/${number})`;
            actionUrl += `/pull/${number}/checks`;
        }
        else {
            actionUrl += `/commit/${sha}/checks`;
        }
        const failedJobsTitle = this.context.payload.workflow_run.display_title;
        const failedJobsUrl = this.context.payload.workflow_run.html_url;
        const branch = this.context.payload.workflow_run.head_branch;
        const commitsUrl = `${repoUrl}/commits/${branch}`;
        return [
            {
                short: true,
                title: 'ran branch',
                value: branch
            },
            {
                short: true,
                title: 'event name',
                value: eventUrl
            },
            {
                short: true,
                title: 'failed workflow',
                value: `[${failedJobsTitle}](${failedJobsUrl})`
            },
            {
                short: true,
                title: 'last commits',
                value: `[Commits](${commitsUrl})`
            },
            {
                short: false,
                title: 'repository',
                value: `[${owner}/${repo}](${repoUrl})`
            }
        ];
    }
    getCommitFields(token, githubUrl) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const { owner, repo } = this.context.repo;
            const head_ref = process.env.GITHUB_HEAD_REF;
            const ref = this.isPullRequest ? head_ref.replace(/refs\/heads\//, '') : this.context.sha;
            let options = {
                log: {
                    debug: console.debug,
                    info: console.info,
                    warn: console.warn,
                    error: console.error
                }
            };
            if (githubUrl) {
                options.baseUrl = `${githubUrl}/api/v3`;
            }
            const client = github.getOctokit(token, options);
            const { data: commit } = yield client.rest.repos.getCommit({ owner, repo, ref });
            const authorName = ((_a = commit.commit.author) === null || _a === void 0 ? void 0 : _a.name) || ((_b = commit.author) === null || _b === void 0 ? void 0 : _b.login) || 'Unknown';
            const authorUrl = ((_c = commit.author) === null || _c === void 0 ? void 0 : _c.html_url) || '';
            const commitMsg = commit.commit.message;
            const commitUrl = commit.html_url;
            const fields = [
                {
                    short: true,
                    title: 'commit',
                    value: `[${commitMsg}](${commitUrl})`
                },
                {
                    short: true,
                    title: 'author',
                    value: `[${authorName}]${authorUrl ? `(${authorUrl})` : ''}`
                }
            ];
            return fields;
        });
    }
}
class RocketChat {
    isMention(condition, status) {
        return condition === 'always' || condition === status;
    }
    generatePayload(jobName, status, mention, mentionCondition, commitFlag, githubUrl, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const helper = new Helper();
            const notificationType = helper[status];
            const tmpText = `${jobName} ${notificationType.result}`;
            const text = mention && this.isMention(mentionCondition, status) ? `@${mention} ${tmpText}` : tmpText;
            const fields = helper.baseFields;
            if (commitFlag && token) {
                const commitFields = yield helper.getCommitFields(token, githubUrl);
                Array.prototype.push.apply(fields, commitFields);
            }
            const attachments = {
                color: notificationType.color,
                fields
            };
            const payload = {
                text,
                attachments: [attachments]
            };
            return payload;
        });
    }
    notify(url, options, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, options), payload);
            console.info(`
			Generated payload for Rocket.Chat:
			${JSON.stringify(data, null, 2)}
		`);
            const response = yield axios_1.default.post(url, data);
            console.info(`
			Response:
			${response.data}
		`);
            if (response.status !== 200) {
                throw new Error(`
				Failed to send notification to Rocket.Chat
				Response: ${response.data}
			`);
            }
        });
    }
}
exports.RocketChat = RocketChat;
