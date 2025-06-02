import { verifyGoogleToken, findOrCreateUser, generateJWT } from '../services/authService.js';

export const googleCallback = async (req, res) => {
  const { idToken } = req.body;
  try {
    const { google_id, email, name } = await verifyGoogleToken(idToken);
    const user = await findOrCreateUser(google_id, email, name);
    const token = generateJWT(user);
    res.json({
      success: true,
      token,
      user: { user_uuid: user.user_uuid, email: user.email, name: user.name, credits: user.credits },
    });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
};