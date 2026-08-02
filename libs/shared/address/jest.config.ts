export default {
  displayName: 'shared-address',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        isolatedModules: true,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'html'],
  coverageDirectory: '../../../coverage/libs/shared/address',
};
