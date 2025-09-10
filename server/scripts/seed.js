const prisma = require('../config/prismaClient');
const {Prisma} = require("../generated/prisma")

async function seed() {
    const users = [
        {
            id: '1',
            firstName: 'Raajesh',
            username: 'rockky',
            email: 'rms@gmail.com',
            password: 'Vartap11132001*#',   
        }
    ]
    try{
        await prisma.$transaction(
            users.map(u => {
                return prisma.user.upsert({
                    where: {
                        email: u.email
                    },
                    update: u,
                    create: u
                })
            })
        )
        console.log("Database seeded sucessfully")
    }catch(err){
        console.error("Error seeding database:", err)
    }
}

seed()