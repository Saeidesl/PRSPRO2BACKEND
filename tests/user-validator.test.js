'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadUserValidator() {
  const context = {
    Constants: {
      ERROR: { VALIDATION_ERROR: 'VALIDATION_ERROR' },
      STATUS: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' }
    },
    ErrorHandler: {
      create: function (code, message) {
        const error = new Error(message);
        error.code = code;
        return error;
      }
    }
  };
  const validatorSource = fs.readFileSync(path.join(__dirname, '..', 'Validator.js'), 'utf8');
  const userValidatorSource = fs.readFileSync(path.join(__dirname, '..', 'UserValidator.js'), 'utf8');
  vm.runInNewContext(validatorSource + '\nthis.__Validator = Validator;\n' +
    userValidatorSource + '\nthis.__UserValidator = UserValidator;', context);
  return context.__UserValidator;
}

test('user creation rejects a missing password', () => {
  const validator = loadUserValidator();
  assert.throws(
    () => validator.validateCreate({ Name: 'Test User', Username: 'test-user' }),
    /رمز عبور.*الزامی است/
  );
});

test('user creation rejects a blank password', () => {
  const validator = loadUserValidator();
  assert.throws(
    () => validator.validateCreate({ Name: 'Test User', Username: 'test-user', Password: '   ' }),
    /رمز عبور.*الزامی است/
  );
});

test('user creation requires at least eight password characters', () => {
  const validator = loadUserValidator();
  assert.throws(
    () => validator.validateCreate({ Name: 'Test User', Username: 'test-user', Password: '1234567' }),
    /حداقل ۸ کاراکتر/
  );
});

test('user creation accepts a password of eight characters', () => {
  const validator = loadUserValidator();
  assert.equal(
    validator.validateCreate({ Name: 'Test User', Username: 'test-user', Password: '12345678' }),
    true
  );
});

test('user update allows an omitted password but rejects an explicitly blank password', () => {
  const validator = loadUserValidator();
  assert.equal(validator.validateUpdate({ Name: 'Updated User' }), true);
  assert.throws(
    () => validator.validateUpdate({ Password: '' }),
    /رمز عبور.*الزامی است/
  );
});

test('user update rejects passwords shorter than eight characters', () => {
  const validator = loadUserValidator();
  assert.throws(
    () => validator.validateUpdate({ Password: '1234567' }),
    /حداقل ۸ کاراکتر/
  );
});
