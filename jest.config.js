/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  moduleFileExtensions: ["js", "jsx", "mjs"],
  transform: {},
  transformIgnorePatterns: [],
  clearMocks: true,
};

module.exports = config;
