export const exclude = <T, Key extends keyof T>(
    item: T,
    ...keys: Key[]
  ): Omit<T, Key> => {
    // eslint-disable-next-line no-restricted-syntax
    for (const key of keys) {
      // eslint-disable-next-line no-param-reassign
      delete item[key];
    }
    return item;
  };
  
  export default exclude;
  