import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GamesService } from './games.service';
import { Game } from '../entities/game.entity';
import { UserGameOwnership } from '../entities/user-game-ownership.entity';
import { UserGameRating } from '../entities/user-game-rating.entity';

describe('GamesService', () => {
  let service: GamesService;

  const mockGamesRepo = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn((data) => data),
    createQueryBuilder: jest.fn(),
  };

  const mockOwnershipRepo = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn((data) => data),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockRatingsRepo = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn((data) => data),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: getRepositoryToken(Game), useValue: mockGamesRepo },
        {
          provide: getRepositoryToken(UserGameOwnership),
          useValue: mockOwnershipRepo,
        },
        { provide: getRepositoryToken(UserGameRating), useValue: mockRatingsRepo },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    jest.clearAllMocks();
  });

  it('updates existing game fields when findOrCreateByBggId is called again', async () => {
    const existingGame = {
      id: 'g-1',
      bggId: 123,
      title: 'Old title',
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 60,
    };

    mockGamesRepo.findOne.mockResolvedValue(existingGame);
    mockGamesRepo.save.mockImplementation(async (data) => data);

    const updated = await service.findOrCreateByBggId(123, {
      title: 'New title',
      minPlayers: 3,
      maxPlayers: 6,
      playingTime: 180,
    });

    expect(mockGamesRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        bggId: 123,
        title: 'New title',
        minPlayers: 3,
        maxPlayers: 6,
        playingTime: 180,
      }),
    );
    expect(updated).toEqual(
      expect.objectContaining({
        bggId: 123,
        title: 'New title',
        minPlayers: 3,
        maxPlayers: 6,
        playingTime: 180,
      }),
    );
  });
});

