module.exports = {
  moduleFileExtensions: ["js", "jsx"],
  testMatch: ["**/specs/**/*specs.{js,jsx,ts,tsx}"],
  rootDir: ".",
  verbose: false,
  resetMocks: true,
  resetModules: true,
  collectCoverageFrom: [
    "src/*.js",
    "!**/*.min.js",
    "!**/static/**",
    "!**/specs/**",
    "!**/node_modules/**"
  ]
};
