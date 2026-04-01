import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationDelivery } from '../entities/notification-delivery.entity';

describe('NotificationDeliveryService', () => {
  let service: NotificationDeliveryService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockRepo = {
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const payload = {
    eventId: 'event-1',
    type: 'feedback_prompt' as const,
    idempotencyKey: 'feedback_prompt:event-1:2026-04-01T11',
    title: 'How was your event?',
    body: 'Share quick feedback.',
    recipientCount: 1,
    recipients: [
      { email: 'user@example.com', userId: 'user-1', name: 'User One' },
    ],
    eventUrl: 'http://localhost:3000/events/event-1',
    feedbackUrl: 'http://localhost:3000/events/event-1#feedback',
    metadata: { attendeeIds: ['user-1'] },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDeliveryService,
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: getRepositoryToken(NotificationDelivery),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationDeliveryService>(
      NotificationDeliveryService,
    );
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue(undefined);
  });

  it('sets attempts to 1 for newly created rows when attempts is undefined', async () => {
    const newRow = {
      attempts: undefined,
      delivered: false,
      endpoint: null,
      lastError: null,
      lastAttemptAt: null,
      deliveredAt: null,
      payload: null,
    };
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(newRow);
    mockRepo.save.mockResolvedValue(newRow);

    await service.send(payload);

    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 1,
      }),
    );
  });

  it('increments attempts for existing rows', async () => {
    const existing = { id: 'delivery-1', delivered: false };
    const existingRow = {
      id: 'delivery-1',
      attempts: 2,
      delivered: false,
      endpoint: null,
      lastError: null,
      lastAttemptAt: null,
      deliveredAt: null,
      payload: null,
    };
    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.findOneByOrFail.mockResolvedValue(existingRow);
    mockRepo.save.mockResolvedValue(existingRow);

    await service.send(payload);

    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'delivery-1',
        attempts: 3,
      }),
    );
  });

  it('normalizes NaN attempts to 1 before save', async () => {
    const newRow = {
      attempts: Number.NaN,
      delivered: false,
      endpoint: null,
      lastError: null,
      lastAttemptAt: null,
      deliveredAt: null,
      payload: null,
    };
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(newRow);
    mockRepo.save.mockResolvedValue(newRow);

    await service.send(payload);

    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 1,
      }),
    );
  });
});
