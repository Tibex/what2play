import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FriendsService } from './friends.service';
import { Friendship } from '../entities/friendship.entity';
import { User } from '../entities/user.entity';

describe('FriendsService', () => {
  let service: FriendsService;

  const mockFriendsRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn((value) => Promise.resolve(value)),
    create: jest.fn((value) => value),
    delete: jest.fn(),
  };

  const mockUsersRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: getRepositoryToken(Friendship), useValue: mockFriendsRepo },
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
    jest.clearAllMocks();
  });

  describe('sendRequestByUserId', () => {
    it('returns sent when request is newly created', async () => {
      mockUsersRepo.findOne.mockResolvedValue({ id: 'u2' });
      mockFriendsRepo.findOne.mockResolvedValue(null);

      const result = await service.sendRequestByUserId('u1', 'u2');

      expect(result).toEqual({ status: 'sent' });
      expect(mockFriendsRepo.create).toHaveBeenCalledWith({
        requesterId: 'u1',
        addresseeId: 'u2',
        status: 'pending',
      });
      expect(mockFriendsRepo.save).toHaveBeenCalled();
    });

    it('returns already_friends for accepted friendship', async () => {
      mockUsersRepo.findOne.mockResolvedValue({ id: 'u2' });
      mockFriendsRepo.findOne.mockResolvedValue({ status: 'accepted' });

      const result = await service.sendRequestByUserId('u1', 'u2');

      expect(result).toEqual({ status: 'already_friends' });
    });

    it('returns request_pending when pending record exists', async () => {
      mockUsersRepo.findOne.mockResolvedValue({ id: 'u2' });
      mockFriendsRepo.findOne.mockResolvedValue({
        requesterId: 'u1',
        addresseeId: 'u2',
        status: 'pending',
      });

      const result = await service.sendRequestByUserId('u1', 'u2');

      expect(result).toEqual({ status: 'request_pending' });
    });

    it('auto-accepts when reverse pending request exists', async () => {
      mockUsersRepo.findOne.mockResolvedValue({ id: 'u2' });
      const existing = {
        requesterId: 'u2',
        addresseeId: 'u1',
        status: 'pending',
      };
      mockFriendsRepo.findOne.mockResolvedValue(existing);

      const result = await service.sendRequestByUserId('u1', 'u2');

      expect(result).toEqual({ status: 'already_friends' });
      expect(existing.status).toBe('accepted');
      expect(mockFriendsRepo.save).toHaveBeenCalledWith(existing);
    });

    it('reopens rejected relationships as sent', async () => {
      mockUsersRepo.findOne.mockResolvedValue({ id: 'u2' });
      const existing = {
        requesterId: 'u2',
        addresseeId: 'u1',
        status: 'rejected',
      };
      mockFriendsRepo.findOne.mockResolvedValue(existing);

      const result = await service.sendRequestByUserId('u1', 'u2');

      expect(result).toEqual({ status: 'sent' });
      expect(existing).toMatchObject({
        requesterId: 'u1',
        addresseeId: 'u2',
        status: 'pending',
      });
      expect(mockFriendsRepo.save).toHaveBeenCalledWith(existing);
    });
  });
});
