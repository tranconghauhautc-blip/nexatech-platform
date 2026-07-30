const path = require('path');
const nxPreset = require('@nx/jest/preset').default;

const workspaceRoot = __dirname;

module.exports = {
  ...nxPreset,
  moduleNameMapper: {
    '^@nexatech/shared-platform$': path.join(
      workspaceRoot,
      'libs/shared/platform/src/index.ts',
    ),
    '^@nexatech/shared-errors$': path.join(
      workspaceRoot,
      'libs/shared/errors/src/index.ts',
    ),
    '^@nexatech/shared-config$': path.join(
      workspaceRoot,
      'libs/shared/config/src/index.ts',
    ),
    '^@nexatech/shared-auth$': path.join(
      workspaceRoot,
      'libs/shared/auth/src/index.ts',
    ),
    '^@nexatech/shared-contracts$': path.join(
      workspaceRoot,
      'libs/shared/contracts/src/index.ts',
    ),
    '^@nexatech/shared-events$': path.join(
      workspaceRoot,
      'libs/shared/events/src/index.ts',
    ),
    '^@nexatech/shared-logging$': path.join(
      workspaceRoot,
      'libs/shared/logging/src/index.ts',
    ),
    '^@nexatech/shared-web$': path.join(
      workspaceRoot,
      'libs/shared/web/src/index.ts',
    ),
  },
};
