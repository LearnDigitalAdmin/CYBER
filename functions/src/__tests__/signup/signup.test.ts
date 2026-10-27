import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  composeAddress, formatPid, isSafaricom, missingProfileFields, normalizeKePhone, parsePidNumber, toLocalPhone, validateProfile, ProfileError,
} from '../../utils/signup.pure';

describe('phone', () => {
  test('normalises Kenyan mobiles', () => {
    for (const p of ['0712345678', '+254712345678', '254712345678', '712345678', '0712 345 678']) {
      assert.equal(normalizeKePhone(p), '254712345678');
    }
    assert.equal(normalizeKePhone('0112345678'), '254112345678');
    assert.equal(toLocalPhone('254712345678'), '0712345678');
  });
  test('rejects bad numbers', () => {
    for (const p of ['', '0212345678', '07123', '25471234567890', null, undefined, {}]) assert.equal(normalizeKePhone(p), null);
  });
});

describe('pid', () => {
  test('format and parse round-trip', () => {
    assert.equal(formatPid(1234), 'COG-1234');
    assert.equal(formatPid(7), 'COG-0007');
    assert.equal(formatPid(12345), 'COG-12345');
    assert.equal(parsePidNumber('COG-1234'), 1234);
    assert.equal(parsePidNumber('x'), null);
  });
});

describe('profile validation', () => {
  test('only known keys, normalised', () => {
    const v = validateProfile({ name: '  Jane   Wanjiru ', id: '1234 5678', altPhone: '0700000001', pId: 'COG-1', paymentInfo: {} } as never, false);
    assert.deepEqual(v, { name: 'Jane Wanjiru', id: '12345678', altPhone: '0700000001' });
  });
  test('locks the sign-in phone', () => {
    assert.equal(validateProfile({ phone: '0711111111' }, true).phone, undefined);
    assert.equal(validateProfile({ phone: '0711111111' }, false).phone, '0711111111');
  });
  test('blank name/id are ignored, bad ones rejected', () => {
    assert.deepEqual(validateProfile({ name: '', id: '' }, false), {});
    assert.throws(() => validateProfile({ id: '12' }, false), ProfileError);
    assert.throws(() => validateProfile({ altPhone: '123' }, false), ProfileError);
    assert.throws(() => validateProfile({ name: 5 }, false), ProfileError);
  });
  test('address', () => {
    assert.equal(composeAddress({ addressLine: 'Moi Ave', ward: 'Kilimani', constituency: 'Dagoretti North', county: 'Nairobi' }), 'Moi Ave, Kilimani, Dagoretti North, Nairobi');
    assert.equal(composeAddress({ county: 'Nairobi' }), 'Nairobi');
  });
});

describe('safaricom only', () => {
  test('accepts Safaricom ranges', () => {
    for (const p of ['0712345678', '0722000000', '0700111222', '0740123456', '0757123456', '0768123456', '0790123456', '0110123456', '0115123456', '0141123456']) {
      assert.equal(isSafaricom(normalizeKePhone(p) as string), true, p);
    }
  });
  test('rejects other networks', () => {
    for (const p of ['0733123456', '0750123456', '0780123456', '0100123456', '0770123456', '0763123456']) {
      assert.equal(isSafaricom(normalizeKePhone(p) as string), false, p);
    }
  });
  test('profile phone must be Safaricom unless unchanged', () => {
    assert.throws(() => validateProfile({ phone: '0733123456' }, false), ProfileError);
    assert.equal(validateProfile({ phone: '0733123456' }, false, '0733123456').phone, '0733123456');
    assert.equal(validateProfile({ altPhone: '0733123456' }, false).altPhone, '0733123456');
  });
});

describe('required fields', () => {
  const full = { name: 'Jane', id: '12345678', phone: '0712345678', email: 'a@b.co', county: 'Nairobi', constituency: 'X', ward: 'Y', addressLine: 'Z' };
  test('complete', () => assert.deepEqual(missingProfileFields(full, 'uid1'), []));
  test('pending email counts, uid-as-id does not', () => {
    assert.deepEqual(missingProfileFields({ ...full, email: '', pendingEmail: 'a@b.co' }, 'uid1'), []);
    assert.deepEqual(missingProfileFields({ ...full, id: 'uid1' }, 'uid1'), ['ID number']);
    assert.deepEqual(missingProfileFields({ ...full, email: '', ward: '' }, 'uid1'), ['email', 'ward']);
  });
});
