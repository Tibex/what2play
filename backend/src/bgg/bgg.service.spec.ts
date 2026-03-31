import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BggService } from './bgg.service';
import { SyncAccount } from '../entities/sync-account.entity';
import { BggVerificationChallenge } from '../entities/bgg-verification-challenge.entity';
import { BggCatalogSync } from '../entities/bgg-catalog-sync.entity';
import { GamesService } from '../games/games.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

describe('BggService', () => {
  let service: BggService;

  const mockSyncRepo = {
    findOne: jest.fn(),
    save: jest.fn((data) => data),
    create: jest.fn((data) => data),
    delete: jest.fn(),
  };

  const mockVerifyRepo = {
    save: jest.fn((data) => data),
    create: jest.fn((data) => data),
  };
  const mockCatalogSyncRepo = {
    findOne: jest.fn(),
    save: jest.fn((data) => data),
    create: jest.fn((data) => data),
  };

  const mockGamesService = {
    findOrCreateByBggId: jest.fn(),
    addToCollection: jest.fn(),
    rateGame: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };
  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BggService,
        { provide: getRepositoryToken(SyncAccount), useValue: mockSyncRepo },
        {
          provide: getRepositoryToken(BggVerificationChallenge),
          useValue: mockVerifyRepo,
        },
        {
          provide: getRepositoryToken(BggCatalogSync),
          useValue: mockCatalogSyncRepo,
        },
        { provide: GamesService, useValue: mockGamesService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<BggService>(BggService);
    jest.clearAllMocks();
  });

  it('parses min/max players from <stats ...> attributes in XML import', async () => {
    mockGamesService.findOrCreateByBggId.mockImplementation(
      async (bggId: number, data: Record<string, unknown>) => ({
        id: `g-${bggId}`,
        bggId,
        ...data,
      }),
    );
    mockGamesService.addToCollection.mockResolvedValue(undefined);

    const xml = `
      <items totalitems="2">
        <item objectid="37111">
          <name>Battlestar Galactica: The Board Game</name>
          <stats minplayers="3" maxplayers="6" playingtime="180"></stats>
        </item>
        <item objectid="36932">
          <name>Claustrophobia</name>
          <stats minplayers="2" maxplayers="2" playingtime="45"></stats>
        </item>
      </items>
    `;

    await service.importCollectionFromXml('u1', xml);

    expect(mockGamesService.findOrCreateByBggId).toHaveBeenNthCalledWith(
      1,
      37111,
      expect.objectContaining({
        title: 'Battlestar Galactica: The Board Game',
        minPlayers: 3,
        maxPlayers: 6,
        playingTime: 180,
      }),
    );
    expect(mockGamesService.findOrCreateByBggId).toHaveBeenNthCalledWith(
      2,
      36932,
      expect.objectContaining({
        title: 'Claustrophobia',
        minPlayers: 2,
        maxPlayers: 2,
        playingTime: 45,
      }),
    );
  });
});
