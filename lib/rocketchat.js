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
    get getBranch() {
        return this.context.payload.workflow_run.head_branch;
    }
    get baseFields() {
        const { sha, eventName } = this.context;
        const { owner, repo } = this.context.repo;
        const { number } = this.context.issue;
        const githubUrl = process.env.GITHUB_URL || core.getInput('github_url') || 'https://github.com';
        const repoUrl = `${githubUrl}/${owner}/${repo}`;
        const branch = this.getBranch;
        let actionUrl = repoUrl;
        let eventUrl = eventName;
        if (this.isPullRequest) {
            eventUrl = `[${eventName}](${repoUrl}/pull/${number})`;
            actionUrl += `/pull/${number}/checks`;
        }
        else {
            actionUrl += `/commit/${sha}/checks`;
        }
        const failedJobsTitle = this.context.payload.workflow_run.name;
        const failedJobsUrl = this.context.payload.workflow_run.html_url;
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
    getFirstFailedWorkflowAfterSuccess(octokit, owner, repo, branch) {
        return __awaiter(this, void 0, void 0, function* () {
            const workflows = yield octokit.rest.actions.listWorkflowRunsForRepo({ owner, repo });
            const workflowRuns = workflows.data.workflow_runs.filter(run => run.name !== this.context.workflow);
            let lastWorkflow = null;
            for (const workflow of workflowRuns) {
                if (workflow.head_branch === branch && workflow.status === "completed") {
                    if (workflow.conclusion === "success") {
                        break;
                    }
                    else if (workflow.conclusion === "failure") {
                        lastWorkflow = workflow;
                    }
                }
            }
            if (lastWorkflow === null) {
                lastWorkflow = workflowRuns.last();
            }
            return lastWorkflow;
        });
    }
    getCommitsSinceWorkflow(octokit, owner, repo, workflow) {
        return __awaiter(this, void 0, void 0, function* () {
            let latestRunTimestamp = workflow.run_started_at;
            if (!latestRunTimestamp) {
                console.error("No completed runs found for the specified workflow.");
                return [];
            }
            const commits = yield octokit.rest.repos.listCommits({ owner, repo });
            return commits.data;
        });
    }
    getCommitters(commits) {
        return __awaiter(this, void 0, void 0, function* () {
            const uniqueCommitters = {};
            for (const commit of commits) {
                const commiter = commit.author;
                if (uniqueCommitters[commiter.html_url]) {
                    continue;
                }
                uniqueCommitters[commiter.html_url] = { name: commiter.login || "", url: commiter.html_url };
            }
            return Object.values(uniqueCommitters);
        });
    }
    getPossibleGuiltiesCommitter(token, branch) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = [];
            let options = {
                log: {
                    debug: console.debug,
                    info: console.info,
                    warn: console.warn,
                    error: console.error
                }
            };
            const { owner, repo } = this.context.repo;
            const octokit = github.getOctokit(token, options);
            const workflow = yield this.getFirstFailedWorkflowAfterSuccess(octokit, owner, repo, branch);
            if (!workflow) {
                return result;
            }
            const commits = yield this.getCommitsSinceWorkflow(octokit, owner, repo, workflow);
            if (!commits || commits.length <= 0) {
                return result;
            }
            const committers = yield this.getCommitters(commits);
            const commitersString = committers.map((committer) => `[${committer.name}](${committer.url})`).join("\n");
            return [{
                    short: true,
                    title: 'Last Commiters',
                    value: commitersString
                }];
        });
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
                    title: 'authors',
                    value: `[${authorName}]${authorUrl ? `(${authorUrl})` : ''}`
                }
            ];
            return fields;
        });
    }
    getAdditionalURLFields(additionalURLName, additionalURLValue) {
        return __awaiter(this, void 0, void 0, function* () {
            return [
                {
                    short: true,
                    title: additionalURLName,
                    value: `[Link](${additionalURLValue})`
                }
            ];
        });
    }
}
class RocketChat {
    isMention(condition, status) {
        return condition === 'always' || condition === status;
    }
    generatePayload(jobName, status, mention, mentionCondition, commitFlag, githubUrl, additionalURL, token, additionalURLName, additionalURLValue) {
        return __awaiter(this, void 0, void 0, function* () {
            const helper = new Helper();
            const notificationType = helper[status];
            const tmpText = `${jobName} ${notificationType.result}`;
            const text = mention && this.isMention(mentionCondition, status) ? `@${mention} ${tmpText}` : tmpText;
            const fields = helper.baseFields;
            if (commitFlag && token) {
                // const commitFields = await helper.getCommitFields(token, githubUrl);
                const commitsInfo = yield helper.getPossibleGuiltiesCommitter(token, helper.getBranch);
                if (commitsInfo.length > 0) {
                    Array.prototype.push.apply(fields, commitsInfo);
                }
            }
            if (additionalURL && additionalURLName && additionalURLValue) {
                const additionalURLFields = yield helper.getAdditionalURLFields(additionalURLName, additionalURLValue);
                Array.prototype.push.apply(fields, additionalURLFields);
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
