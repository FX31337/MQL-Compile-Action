const github = require('@actions/github');
const core = require('@actions/core');

function getBody(warnings, errors) {
    return `Compilation Warnings:\n${warnings.join('\n')}\n\nCompilation Errors:\n${errors.join('\n')}\n`;
}

module.exports = (warnings, errors) => {
    const payload = github.context.payload;

    if (github.context.eventName !== 'pull_request')
      return;
    const octokit = github.getOctokit(core.getInput('github-token'));
    octokit.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.number, // eslint-disable-line camelcase
      body: getBody(warnings, errors)
    });

};
