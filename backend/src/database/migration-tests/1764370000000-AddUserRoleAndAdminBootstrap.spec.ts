import { QueryRunner } from 'typeorm';
import { AddUserRoleAndAdminBootstrap1764370000000 } from '../migrations/1764370000000-AddUserRoleAndAdminBootstrap';

describe('AddUserRoleAndAdminBootstrap1764370000000', () => {
  it('adds role column and promotes tibexor@gmail.com', async () => {
    const migration = new AddUserRoleAndAdminBootstrap1764370000000();
    const query = jest.fn();
    const queryRunner = {
      query,
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN IF NOT EXISTS "role"'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("LOWER('tibexor@gmail.com')"),
    );
  });
});
