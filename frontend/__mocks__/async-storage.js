const store = new Map();
const AsyncStorage = {
  getItem: jest.fn(async (key) => store.get(key) || null),
  setItem: jest.fn(async (key, value) => { store.set(key, value); }),
  removeItem: jest.fn(async (key) => { store.delete(key); }),
};
module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
