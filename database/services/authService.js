import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/user.js';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const verifyGoogleToken = async (idToken) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return {
      google_id: payload['sub'],
      email: payload['email'],
      name: payload['name'],
    };
  } catch (error) {
    throw new Error('Invalid Google token');
  }
};

export const findOrCreateUser = async (googleId, email, name) => {
  let user = await User.findOne({ where: { google_id: googleId } });
  if (!user) {
    user = await User.findOne({ where: { email } });
    if (user) {
      user.google_id = googleId;
      user.name = name;
      await user.save();
    } else {
      user = await User.create({ google_id: googleId, email, name });
    }
  } else if (user.name !== name) {
    user.name = name;
    await user.save();
  }
  return user;
};

export const generateJWT = (user) => {
  return jwt.sign({ user_uuid: user.user_uuid }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};