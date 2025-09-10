require('dotenv').config()
const passport = require('passport');
const { ExtractJwt, Strategy: JwtStrategy } = require("passport-jwt");
const prisma = require('./prismaClient');

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
        console.log('Error in passport stratedgy: ',err)
        return done(err, false)
    }
}))

module.exports = passport;