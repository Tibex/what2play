import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Event } from '../entities/event.entity';
import { User } from '../entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockUsersRepo = {
    findOne: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEventsRepo = {
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
        { provide: getRepositoryToken(Event), useValue: mockEventsRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('deleteForAdmin', () => {
    it('rejects self-delete attempts', async () => {
      await expect(service.deleteForAdmin('admin-1', 'admin-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mockUsersRepo.findOne).not.toHaveBeenCalled();
      expect(mockEventsRepo.delete).not.toHaveBeenCalled();
      expect(mockUsersRepo.delete).not.toHaveBeenCalled();
    });

    it('throws when target user does not exist', async () => {
      mockUsersRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteForAdmin('user-1', 'admin-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockEventsRepo.delete).not.toHaveBeenCalled();
      expect(mockUsersRepo.delete).not.toHaveBeenCalled();
    });

    it('deletes hosted events before deleting the user', async () => {
      mockUsersRepo.findOne.mockResolvedValue({ id: 'user-1' });

      await service.deleteForAdmin('user-1', 'admin-1');

      expect(mockEventsRepo.delete).toHaveBeenCalledWith({ hostId: 'user-1' });
      expect(mockUsersRepo.delete).toHaveBeenCalledWith('user-1');
    });
  });
});
