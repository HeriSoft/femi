import { verifyGoogleToken } from '../src/services/authService.js';

// Mock Google OAuth
jest.mock('google-auth-library');

describe('Auth Service', () => {
  it('should verify Google token', async () => {
    const mockToken = 'valid_token';
    const mockPayload = { sub: '123', email: 'test@example.com', name: 'Test User' };
    const mockTicket = { getPayload: () => mockPayload };
    require('google-auth-library').OAuth2Client.prototype.verifyIdToken.mockResolvedValue(mockTicket);

    const result = await verifyGoogleToken(mockToken);
    expect(result).toEqual({ google_id: '123', email: 'test@example.com', name: 'Test User' });
  });
});