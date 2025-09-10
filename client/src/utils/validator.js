export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return !emailRegex.test(email) ? 'Please enter a valid email address' : null;
};

export const validatePassword = (password) => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/\d/.test(password)) {
    return 'Password must contain at least one number.';
  }
  return null;
};

export const validateLoginPassword = (password) => {
  return password.length === 0 ? 'Password is required' : null
}

export const validateUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9]{4,}$/;
  return !usernameRegex.test(username) ? 'Username must be at least 4 characters and contain only letters and numbers' : null;
};

export const validateName = (name, fieldName) => {
  return name.length < 2 ? `${fieldName} name must be at least 2 characters` : null;
};

export const validatePasswordMatch = (password, confirmPassword) => {
  return password !== confirmPassword ? 'Passwords do not match' : null;
};