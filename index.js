const express =require('express')
const cors=require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port=process.env.PORT || 5000;

const app=express();

//middleware
app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bje6fgv.mongodb.net/?retryWrites=true&w=majority`;
 console.log(uri)

// console.log(process.env.ACCESS_TOKEN)
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}





async function run(){

    try{
        const catagorisCollections=client.db('assingment12').collection('catagoris');
        const bookingCollection=client.db('assingment12').collection('bookings');
        const userCollection=client.db('assingment12').collection('users');
        const paymentCollection=client.db('assingment12').collection('payments');
        

          //verify admin
        const verifyAdmin = async (req, res, next) =>{
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await userCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }







        app.get('/catagories',async(req,res)=>{
            const query={};
            const catagoris= await catagorisCollections.find(query).toArray();
            res.send(catagoris);
        });

        app.get('/catagorie/:id',async(req,res)=>{
            const id=req.params.id;
            // console.log(id);
            const query={_id:ObjectId(id)};
            // console.log(query);
            const result=await catagorisCollections.findOne(query);
            res.send(result);


        });
       
        
      //delet spacify
        app.put('/catagories',verifyJWT,  async(req,res)=>{
          
            const name=req.body.names;
            const categories_name=req.body.categories_names
            
          
            const result=await catagorisCollections.updateOne(
                { categories_name: categories_name },
                { $pull: { 'categories_name.products':{name:name } }}
            )
        });
 
        ///
        app.put('/catagories',async(req,res)=>{
           
                const  categories_name=req.body.categories_name
                const product=req.body
            
             const query={
                categories_name:product.catagory
             };
           
            //const insertproduct= await catagorisCollections.insertOne(product)
            const result=await catagorisCollections.updateOne(
                { categories_name: categories_name },
                  {$addToSet: { products: product } }
            )
            res.send(result);
        });
        // app.get('/catagories/:email',async(req,res)=>{
        //     const email=req.params.products.email;
        //      const query={email};
        //      const user=await userCollection.findOne(query);
        //      res.send(email);
        //  });
        //  //
      
          //for payment
          app.post('/create-payment-intent',async(req,res)=>{
            const booking=req.body;
            const price=parseInt(booking.price);
            const amount=price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount:amount,
                currency: "usd",
               "payment_method_types": [
                  "card"
               ]
              });
              res.send({
                clientSecret: paymentIntent.client_secret,
              });
            
        });
         // store payment data in database
         app.post('/payments',async(req,res)=>{

            const payment=req.body;
            const result= await paymentCollection.insertOne(payment);
            const id=payment.bookingId
            const filter={_id:ObjectId(id)}
            const updateDoc={
                $set:{
                    paid:true,
                    transactionId:payment.transactionId
                }
            }
            const updateResult= await bookingCollection.updateOne(filter,updateDoc)
            res.send(result);
        });

    
        //get spacific user information by gmail
        app.get('/bookings',verifyJWT,async(req,res)=>{
            const email=req.query.email;
            const query={email:email};
            const decodedEmail=req.decoded.email;
            if(email!=decodedEmail){
                return res.status(403).send({message:'fobidden access'})
            }
            const bookings= await bookingCollection.find(query).toArray()
            res.send(bookings)
        })

        app.post('/bookings',async(req,res)=>{
      const booking=req.body;
      console.log(booking);
      const result=await bookingCollection.insertOne(booking);
      res.send(result);
            
        });

        app.get('/bookings/:id',async(req,res)=>{

            const id=req.params.id;
            const query={_id:ObjectId(id)};
            const booking=await bookingCollection.findOne(query);
            res.send(booking);


        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });

        app.get('/users',async(req,res)=>{

        const query={};
        const users=await userCollection.find(query).toArray();
         res.send(users);

        });
        //
        app.get('/users/:email',async(req,res)=>{
            const email=req.params.email;
             const query={email};
             const user=await userCollection.findOne(query);
             res.send({isSeller:user?.role ==='seller'});
         });
         //
        app.get('/users/admin/:email',async(req,res)=>{
            const email=req.params.email;
             const query={email};
             const user=await userCollection.findOne(query);
             res.send({isAdmin:user?.role ==='admin'});
         });
 
       //
        app.put('/users/admin/:id', verifyJWT, verifyAdmin, async(req,res)=>{

            // const decodedEmail=req.decoded.email;
            // const query={email:decodedEmail};
            // user=await userCollection.findOne(query)
            // if(user?.role!=='admin'){
            //     res.status(403).send({message:'forbidden'})
            // }
            //
            const id=req.params.id;
            const filter={_id:ObjectId(id)};
            const options={upsert:true};
            const updateDoc={
                $set:{
                    role:'seller'
                }
            }
            const result=await userCollection.updateOne(filter,updateDoc,options);
            res.send(result);

        });

        app.post('/users', async(req,res)=>{
        const user=req.body;
        const result=await userCollection.insertOne(user);
        res.send(result)


        });
        app.delete('/users/:id',verifyJWT, verifyAdmin, async(req,res)=>{
          
            const id=req.params.id;
            const filter={_id:ObjectId(id)}
            const result=  await userCollection.deleteOne(filter);
            res.send(result);
        });
        

    }
   finally{


   }

}
run().catch(err=>console.log(err));









app.get('/',async(req,res)=>{
        res.send('running');
    });

 app.listen(port,()=>{
        console.log("run");
    })

    //assingment12
    //catagoris
    // app.get('/courses/:id', (req,res)=>{
    //     const id=req.params.id;
    //     const catagory_news= courses.find(n=>n.id==id)
    //     res.send(catagory_news);
        
    // })