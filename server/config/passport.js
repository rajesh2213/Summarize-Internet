require('dotenv').config()
const passport = require('passport');
const { ExtractJwt, Strategy: JwtStrategy } = require("passport-jwt");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./prismaClient');
const logger = require('./logHandler');

const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
}

passport.use(new JwtStrategy(options, async (jwtPayload, done) => {
    try{
        const user = await prisma.user.findUnique({
            where: {
                id: jwtPayload.id
            }
        })
        if(!user){
            return done(null, false, {message: 'User not found'})
        }
        return done(null, user)
    }catch(err){
        logger.error('Error in passport strategy: ',err)
        return done(err, false)
    }
}))

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await prisma.user.findUnique({
            where: { googleId: profile.id }
        });

        if (user) {
            return done(null, user);
        }

        user = await prisma.user.findUnique({
            where: { email: profile.emails[0].value }
        });

        if (user) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    googleId: profile.id,
                    profilePicture: profile.photos[0]?.value,
                    authProvider: 'google'
                }
            });
            return done(null, user);
        }

        const username = profile.emails[0].value.split('@')[0] + '_' + profile.id.slice(-4);
        user = await prisma.user.create({
            data: {
                googleId: profile.id,
                email: profile.emails[0].value,
                firstName: profile.name.givenName,
                lastName: profile.name.familyName,
                username: username,
                profilePicture: profile.photos[0]?.value,
                authProvider: 'google',
                isVerified: true
            }
        });

        return done(null, user);
    } catch (error) {
        logger.error('Error in Google OAuth strategy:', error);
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id }
        });
        done(null, user);
    } catch (error) {
        logger.error('Error deserializing user:', error);
        done(error, null);
    }
});

module.exports = passport;