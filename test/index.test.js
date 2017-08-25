import moxios from 'moxios';
import fixtureSuccess from './fixtures/success';
import fixtureFailureNoCursor from './fixtures/failure-no-cursor';
import fixtureFailure from './fixtures/failure';
import getLastSuccessfulCommit, { graphqlEndpoint } from '../src';

describe('while using getLastSuccessfulCommit() with wrong options', () => {
  it('should throw with empty "owner"', async () => {
    // Arrange
    const invalidOwner1 = () => getLastSuccessfulCommit();
    const invalidOwner2 = () => getLastSuccessfulCommit({});
    const invalidOwner3 = () => getLastSuccessfulCommit({ name: 'asd', token: 'qwe' });

    // Act
    const ownerError1 = await getErr(invalidOwner1);
    const ownerError2 = await getErr(invalidOwner2);
    const ownerError3 = await getErr(invalidOwner3);

    // Assert
    expect(ownerError1).toBeInstanceOf(Error);
    expect(ownerError1.message).toMatch(/"owner" needs to be defined/);
    expect(ownerError2).toBeInstanceOf(Error);
    expect(ownerError2.message).toMatch(/"owner" needs to be defined/);
    expect(ownerError3).toBeInstanceOf(Error);
    expect(ownerError3.message).toMatch(/"owner" needs to be defined/);
  });

  it('should throw with empty "name"', async () => {
    // Arrange
    const invalidName1 = () => getLastSuccessfulCommit({ token: 'asd', owner: 'qwe' });
    const invalidName2 = () => getLastSuccessfulCommit({ owner: 'qwe' });

    // Act
    const nameError1 = await getErr(invalidName1);
    const nameError2 = await getErr(invalidName2);

    // Assert
    expect(nameError1).toBeInstanceOf(Error);
    expect(nameError1.message).toMatch(/"name" needs to be defined/);
    expect(nameError2).toBeInstanceOf(Error);
    expect(nameError2.message).toMatch(/"name" needs to be defined/);
  });

  it('should throw with empty "token"', async () => {
    // Arrange
    const invalidToken1 = () => getLastSuccessfulCommit({ name: 'asd', owner: 'qwe' });

    // Act
    const tokenError = await getErr(invalidToken1);

    // Assert
    expect(tokenError).toBeInstanceOf(Error);
    expect(tokenError.message).toMatch(/"token" needs to be defined/);
  });
});

describe('while using getLastSuccessfulCommit()', () => {
  beforeEach(() => {
    moxios.install();
  });

  afterEach(() => {
    moxios.uninstall();
  });

  it('should fail with invalid token', async () => {
    // Arrange
    const invalidToken = () => getLastSuccessfulCommit({ name: 'asd', owner: 'qwe', token: 'zxc' });
    moxios.stubRequest(graphqlEndpoint, {
      status: 401,
      responseText: 'Unauthorized'
    });

    // Act
    const [error] = await Promise.all([getErr(invalidToken), moxiosWaitPromisified()]);

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/Request failed with status code 401/);
  });

  it('should get last successful commit with "SUCCESS" commit on first page', async () => {
    // Arrange
    const triggerGet = () =>
      getLastSuccessfulCommit({ name: 'asd', owner: 'qwe', token: 'valid-token' });
    moxios.stubRequest(graphqlEndpoint, {
      status: 200,
      responseText: fixtureSuccess
    });

    // Act
    const [lastSuccessfulCommit] = await Promise.all([triggerGet(), moxiosWaitPromisified()]);

    // Assert
    expect(lastSuccessfulCommit).toMatchObject({
      node: {
        status: { state: 'SUCCESS' },
        message: 'Something good 8',
        oid: 'fe5dbbcea5ce7e2988b8c69bcfdfde8904aabc1f'
      }
    });
  });

  it('should get last successful commit with "SUCCESS" commit on second page', async () => {
    // Arrange
    const triggerGet = () =>
      getLastSuccessfulCommit({ name: 'asd', owner: 'qwe', token: 'valid-token' });
    async function firstFailureSecondSuccess() {
      await moxiosWaitPromisified();
      const requestFailure = moxios.requests.mostRecent();
      requestFailure.respondWith({
        status: 200,
        responseText: fixtureFailure
      });
      await moxiosWaitPromisified();
      const requestSuccess = moxios.requests.mostRecent();

      requestSuccess.respondWith({
        status: 200,
        responseText: fixtureSuccess
      });
    }

    // Act
    const [lastSuccessfulCommit] = await Promise.all([triggerGet(), firstFailureSecondSuccess()]);

    // Assert
    expect(lastSuccessfulCommit).toMatchObject({
      node: {
        status: { state: 'SUCCESS' },
        message: 'Something good 8',
        oid: 'fe5dbbcea5ce7e2988b8c69bcfdfde8904aabc1f'
      }
    });
  });

  it("should return null if doesn't find the last successful commit", async () => {
    // Arrange
    const triggerGet = () =>
      getLastSuccessfulCommit({ name: 'asd', owner: 'qwe', token: 'valid-token' });
    moxios.stubRequest(graphqlEndpoint, {
      status: 200,
      responseText: fixtureFailureNoCursor
    });

    // Act
    const [lastSuccessfulCommit] = await Promise.all([triggerGet(), moxiosWaitPromisified()]);

    // Assert
    expect(lastSuccessfulCommit).toBe(null);
  });
});

async function getErr(promiseFunction) {
  try {
    await promiseFunction();
  } catch (err) {
    return err;
  }

  return null;
}

function moxiosWaitPromisified() {
  return new Promise(resolve => {
    moxios.wait(() => {
      resolve();
    });
  });
}
