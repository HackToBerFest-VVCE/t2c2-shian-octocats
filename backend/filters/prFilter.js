const HOLD_SCORE_THRESHOLD = 40;
const MAX_OPEN_PRS = 5;
const CAREFUL_CHANGE_THRESHOLD = 500;
const FAST_TRACK_SCORE_THRESHOLD = 70;
const FAST_TRACK_CHANGE_THRESHOLD = 200;

const LOCKFILE_NAMES = new Set([
  "bun.lock",
  "bun.lockb",
  "cargo.lock",
  "composer.lock",
  "gemfile.lock",
  "gopkg.lock",
  "npm-shrinkwrap.json",
  "package-lock.json",
  "pipfile.lock",
  "poetry.lock",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

const CODE_FILE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".go",
  ".h",
  ".hpp",
  ".java",
  ".mjs",
  ".cjs",
  ".js",
  ".jsx",
  ".kt",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".scala",
  ".sh",
  ".swift",
  ".ts",
  ".tsx",
  ".vue",
]);

function isTestFile(path) {
  const normalizedPath = path.replaceAll("\\", "/").toLowerCase();
  const basename = normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1);

  return (
    /(^|\/)(__tests__|tests?|specs?)\//.test(normalizedPath) ||
    /(^|\/)test_[^/]+/.test(normalizedPath) ||
    /^test\.[^./]+$/.test(basename) ||
    /\.(test|spec)\.[^./]+$/.test(basename) ||
    /_test\.[^./]+$/.test(basename)
  );
}

function isSensitiveFile(path) {
  const normalizedPath = path.replaceAll("\\", "/").toLowerCase();
  const basename = normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1);

  return (
    normalizedPath.startsWith(".github/workflows") ||
    basename === "package.json" ||
    LOCKFILE_NAMES.has(basename) ||
    basename.endsWith(".lock") ||
    basename === ".env" ||
    basename.startsWith(".env.") ||
    normalizedPath.includes("auth") ||
    normalizedPath.includes("security")
  );
}

// Evaluate the risk lane from supplied data only; this function never performs I/O.
export function evaluatePR({ pr, files, agent, openPRsByAgent }) {
  const changedLines = pr.additions + pr.deletions;
  const sensitiveFiles = files.filter(isSensitiveFile);
  const score = agent?.score;
  const holdReasons = [];
  const carefulReasons = [];
  const touchesWorkflows = sensitiveFiles.some((path) =>
    path.replaceAll("\\", "/").toLowerCase().startsWith(".github/workflows"),
  );

  if (pr.draft) {
    holdReasons.push("The pull request is a draft.");
  }
  if (agent && score < HOLD_SCORE_THRESHOLD) {
    holdReasons.push(`The agent score is below ${HOLD_SCORE_THRESHOLD}.`);
  }
  if (openPRsByAgent > MAX_OPEN_PRS) {
    holdReasons.push(`The agent has more than ${MAX_OPEN_PRS} open pull requests.`);
  }

  if (!agent) {
    carefulReasons.push("The pull request author is not a registered agent.");
  }
  if (touchesWorkflows) {
    carefulReasons.push("The pull request touches .github/workflows.");
  }
  if (sensitiveFiles.some((path) => {
    const normalizedPath = path.replaceAll("\\", "/").toLowerCase();
    return !normalizedPath.startsWith(".github/workflows");
  })) {
    carefulReasons.push("The pull request changes sensitive files.");
  }
  if (changedLines > CAREFUL_CHANGE_THRESHOLD) {
    carefulReasons.push(`The pull request changes more than ${CAREFUL_CHANGE_THRESHOLD} lines.`);
  }

  const hasTestFile = files.some(isTestFile);
  const hasNonTestCodeFile = files.some((path) => {
    if (isTestFile(path)) {
      return false;
    }

    const normalizedPath = path.replaceAll("\\", "/");
    const basename = normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1);
    const extension = basename.slice(basename.lastIndexOf(".")).toLowerCase();
    return CODE_FILE_EXTENSIONS.has(extension);
  });
  const fastTrackEligible =
    agent !== null &&
    agent !== undefined &&
    score >= FAST_TRACK_SCORE_THRESHOLD &&
    changedLines < FAST_TRACK_CHANGE_THRESHOLD &&
    sensitiveFiles.length === 0 &&
    typeof pr.body === "string" &&
    pr.body.trim().length > 0 &&
    (!hasNonTestCodeFile || hasTestFile);

  if (holdReasons.length > 0) {
    return { lane: "hold", reasons: [...holdReasons, ...carefulReasons] };
  }
  if (carefulReasons.length > 0) {
    return { lane: "careful", reasons: carefulReasons };
  }
  if (fastTrackEligible) {
    return {
      lane: "fast-track",
      reasons: ["The agent, change size, files, description, and tests meet fast-track criteria."],
    };
  }

  return { lane: "standard", reasons: ["The pull request does not meet fast-track criteria."] };
}
