// verification test script for auth service
const API_URL = 'http://localhost:3000/api/auth';

async function runTests() {
  console.log('🚀 Starting Authentication Service API verification tests...');
  let testUserToken = null;
  let testUser2Token = null;

  // Helper for JSON requests
  const request = async (path, method, body = null, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);
    
    const response = await fetch(`${API_URL}${path}`, config);
    const data = await response.json();
    return { status: response.status, data };
  };

  try {
    // 1. Register test user
    console.log('\n1. Testing User Registration...');
    const regResult = await request('/register', 'POST', {
      username: 'test_verify_user',
      email: 'test_verify@example.com',
      password: 'password123'
    });
    
    if (regResult.status === 201 && regResult.data.token) {
      console.log('✅ Registration success!');
      testUserToken = regResult.data.token;
    } else if (regResult.status === 400 && regResult.data.error.includes('already')) {
      console.log('⚠️ Test user already exists from previous runs, proceeding with login test.');
    } else {
      throw new Error(`Registration failed: Status ${regResult.status}, Error: ${regResult.data.error}`);
    }

    // 2. Register same user again (Conflict verification)
    console.log('\n2. Testing Registration Conflicts (Duplicate check)...');
    const conflictResult = await request('/register', 'POST', {
      username: 'test_verify_user',
      email: 'test_verify@example.com',
      password: 'password123'
    });
    if (conflictResult.status === 400) {
      console.log(`✅ Correctly blocked conflict! Server response: "${conflictResult.data.error}"`);
    } else {
      throw new Error(`Conflict check failed! Expected 400, got ${conflictResult.status}`);
    }

    // 3. Login test user
    console.log('\n3. Testing User Login...');
    const loginResult = await request('/login', 'POST', {
      identity: 'test_verify_user',
      password: 'password123'
    });
    if (loginResult.status === 200 && loginResult.data.token) {
      console.log('✅ Login success!');
      testUserToken = loginResult.data.token;
    } else {
      throw new Error(`Login failed: Status ${loginResult.status}, Error: ${loginResult.data.error}`);
    }

    // 4. Fetch profile
    console.log('\n4. Testing Profile Retrieval (Protected route)...');
    const profileResult = await request('/profile', 'GET', null, testUserToken);
    if (profileResult.status === 200 && profileResult.data.user) {
      console.log(`✅ Profile retrieved! Username: "${profileResult.data.user.username}", Email: "${profileResult.data.user.email}"`);
    } else {
      throw new Error(`Profile fetch failed: Status ${profileResult.status}`);
    }

    // 5. Update Profile
    console.log('\n5. Testing Profile Credentials Update...');
    const updateResult = await request('/profile', 'PUT', {
      username: 'test_verify_user_updated',
      email: 'test_verify_updated@example.com',
      password: 'password123',
      newPassword: 'newpassword123'
    }, testUserToken);

    if (updateResult.status === 200 && updateResult.data.token) {
      console.log(`✅ Profile update success! Message: "${updateResult.data.message}"`);
      testUser2Token = updateResult.data.token;
    } else {
      throw new Error(`Profile update failed: Status ${updateResult.status}, Error: ${updateResult.data.error}`);
    }

    // 6. Login with new credentials
    console.log('\n6. Testing Login with New Password...');
    const loginNewResult = await request('/login', 'POST', {
      identity: 'test_verify_user_updated',
      password: 'newpassword123'
    });
    if (loginNewResult.status === 200 && loginNewResult.data.token) {
      console.log('✅ Login with new password success!');
      testUser2Token = loginNewResult.data.token;
    } else {
      throw new Error(`New credentials login failed: Status ${loginNewResult.status}`);
    }

    // 7. Delete profile
    console.log('\n7. Testing Account Deletion...');
    const deleteResult = await request('/profile', 'DELETE', {
      password: 'newpassword123'
    }, testUser2Token);

    if (deleteResult.status === 200) {
      console.log(`✅ Account deleted! Message: "${deleteResult.data.message}"`);
    } else {
      throw new Error(`Account deletion failed: Status ${deleteResult.status}, Error: ${deleteResult.data.error}`);
    }

    // 8. Confirm deletion by checking profile
    console.log('\n8. Confirming deletion by attempting profile fetch...');
    const checkDeletedResult = await request('/profile', 'GET', null, testUser2Token);
    if (checkDeletedResult.status === 404 || checkDeletedResult.status === 401) {
      console.log(`✅ Correctly denied access! Server returned: Status ${checkDeletedResult.status}`);
    } else {
      throw new Error(`Profile check after deletion failed! Expected 404 or 401, got ${checkDeletedResult.status}`);
    }

    console.log('\n🎉 ALL PROGRAMMATIC API TESTS COMPLETED SUCCESSFULLY! 🎉');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test execution failed with error:', error.message);
    process.exit(1);
  }
}

runTests();
