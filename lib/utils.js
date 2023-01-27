"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidCondition = exports.validateStatus = void 0;
const jobStatuses = ['success', 'failure', 'cancelled'];
const mentionConditions = [...jobStatuses, 'always'];
function isValid(target, validList) {
    return validList.includes(target);
}
/**
 * Check if status entered by user is allowed by GitHub Actions.
 * @param {string} jobStatus
 * @returns {string|Error}
 */
function validateStatus(jobStatus) {
    if (!isValid(jobStatus, jobStatuses)) {
        throw new Error('Invalid type parameter');
    }
    return jobStatus;
}
exports.validateStatus = validateStatus;
function isValidCondition(condition) {
    return isValid(condition, mentionConditions);
}
exports.isValidCondition = isValidCondition;
