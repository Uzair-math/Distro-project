const express = require('express')
const app = express();
const cors = require('cors')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const PORT = 1212;
const multer = require('multer')
const secretKey = 'your-secret-key'
const path = require("path");
const { type } = require('os');
const { Socket } = require('socket.io');
const httpServer = require('http').createServer(app);
const nodemailer = require('nodemailer');

const io = require('socket.io')(httpServer, {
    cors: { origin: '*' }
});

// io.on('connection', (socket) => {
//     console.log('user connected successfully', socket.id)
//     socket.on('likeView', (data) => {
//         io.emit('resLike', data)
//     })
//     socket.on('viewComment', (data) => {
//         io.emit('resComment', data)
//     })
//     // socket.on('viewMessage',(data) => {
//     //     console.log('view comment',data)
//     //     io.emit('resMessage',data)
//     // })
//     socket.on('disconnect', () => {
//         console.log('a user disconnected!');
//     });
// })

app.use(cors())
app.use(express.json())
app.use('/static', express.static('pic'))

mongoose.connect('mongodb+srv://zaindev:new123@cluster0.qvazh4d.mongodb.net/')
    .then(() => {
        console.log('Data Base Connected')
    })
    .catch((err) => {
        console.log('Not Connected', err)
    })

const userSchema = mongoose.model('user', mongoose.Schema({
    username: {
        type: String,
        require: true
    },
    email: {
        type: String,
        require: true
    },
    password: {
        type: String,
        require: true
    },
    isVerified: {
        type: Boolean
    },
    OTP: {
        type: String
    }
}))

const allPostSchema = mongoose.model('allPosts', mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    },
    picture: {
        type: Object
    },
    id: {
        type: Number,
        unique: true,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "comment" }]
}))

const commentSchema = mongoose.model('comment', mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
    },
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "allPosts"
    },
    comment: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    replies: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'reply'
    }]
}));

const replySchema = mongoose.model('reply', mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
    },
    commentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "comment"
    },
    reply: String
}))

const messageSchema = mongoose.model('message', mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}))

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'pic');
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + '-' + file.originalname);
    },
});

const upload = multer({ storage: storage });


const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'otpt0971@gmail.com',
        pass: 'wdop mgac offq qniw'
    },
});

app.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        if (!username || !email || !password) {
            return res.json({ message: "All fileds must be required" })
        }
        if (username.length <= 2) {
            return res.json({ message: "username must be 3 characters" })
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.json({ message: "Invalid email" })
        }
        if (password.length <= 7) {
            return res.json({ message: "password must be 8 characters" })
        }
        const existingUser = await userSchema.findOne({ email })
        if (existingUser) {
            return res.json({ message: "user already registered" })
        }
        const dataSave = new userSchema({
            username: username,
            email: email,
            password: password,
            isVerified: false,
            OTP: otp
        })
        await dataSave.save()

        const mailOptions = {
            from: 'otpt0971@gmail.com',
            to: email,
            subject: 'OTP for Account Verification',
            text: `Your verification code is : ${otp}`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                return res.json({ error: 'Failed to send OTP' });
            }
        });

        res.status(201).json({ message: 'OTP sent. Please verify your email.' });
    } catch (error) {
        res.json({ message: 'something went wrong' })
    }
})

app.post('/verify', async (req, res) => {
    try {
        const dataInfo = req.body.data.otp
        const findUser = await userSchema.findOne({ OTP: dataInfo })
        if (!findUser) {
            return res.json({ message: "Invalid OTP" })
        }

        if (findUser.OTP == dataInfo) {
            findUser.isVerified = true
            await findUser.save()
            res.json({ message: "Account verified successfully" })
        } else {
            res.json({ message: "Invalid OTP" })
        }
    } catch (error) {
        res.json({ message: 'something went wrong', error })
    }
})

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.json({ message: 'Email and password are required' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.json({ message: "Invalid email" })
        }
        const user = await userSchema.findOne({ email: email });
        if (!user) {
            return res.json({ message: 'User not found' });
        }


        if (user.password == password) {
            if (user.isVerified == true) {
                const token = jwt.sign({ userId: user._id, email: user.email }, secretKey, { expiresIn: '100h' });
                res.json({ message: "login successfully", user, token })
            } else {
                res.json({ message: "You need to verify your email" })
            }
        } else {
            res.json({ message: "Incorrect Password" })
        }
    } catch (error) {
        res.json({ message: 'something went wrong' })
    }
});

app.get('/allPosts', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token,secretKey)
        const userId = decodedToken.userId
        
        const viewData = await allPostSchema.find().populate('userId').sort({ $natural: -1 })
        
        // console.log("viewData :",viewData)
        res.send(viewData)
    } catch (error) {
        res.json({ message: "something went wrong", err: error })
    }
})

app.get('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey)
        const userId = decodedToken.userId
        const myPosts = await allPostSchema.find({ userId }).sort({ $natural: -1 })
        if (!myPosts) {
            return res.json({ message: "you did not upload any post" })
        }
        res.send(myPosts)
    } catch (error) {
        res.json({ message: 'some thing wrong', err: error })
    }
})

app.post('/posts', upload.single('profilePicture'), async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const userId = decodedToken.userId;
        const { id, title, body } = req.body;
        const profilePicture = req.file;
        if (!id || !title || !body || !profilePicture) {
            return res.json({ message: "All fields must be required" });
        }
        const existingPost = await allPostSchema.findOne({ id });
        if (existingPost) {
            return res.json({ message: "Post already saved" });
        }
        const dataSave = new allPostSchema({
            userId,
            id,
            title,
            body,
            picture: profilePicture.path
        });
        await dataSave.save()
        res.json({ message: "Post created successfully", data: dataSave });
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
});

app.get('/post/:id', async (req, res) => {
    try {
        const getPost = req.params.id;
        const findPost = await allPostSchema.findOne({ _id: getPost })
        if (!findPost) {
            return res.json({ message: "post not found" })
        }
        res.json({ message: "success", result: findPost })
    } catch (error) {
        res.json({ message: "something went wrong", err: error })
    }
})

app.delete('/delete/:id', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey)
        const userId = decodedToken.userId
        const getPost = req.params.id
        const findPost = await allPostSchema.findOne({ id: getPost })
        if (findPost.userId != userId) {
            return res.json({ message: "you cannot delete this post" })
        }
        await allPostSchema.deleteOne({ id: getPost });
        res.json({ message: "post delete successfully" })
    } catch (error) {
        res.send(error)
    }
})

app.put('/edit/:postId', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey)
        const userId = decodedToken.userId
        const getPost = req.params.postId
        const { id, title, body } = req.body;
        if (!id || !title || !body) {
            return res.json({ message: "All fields are required" });
        }
        const existingPost = await allPostSchema.findOne({ id: getPost });
        if (existingPost.userId != userId) {
            return res.json({ message: "you cannot edit this post" })
        }
        existingPost.id = id;
        existingPost.title = title;
        existingPost.body = body;
        await existingPost.save();
        res.json({ message: "Post updated successfully" });
    } catch (error) {
        res.json({ message: 'Something went wrong', error: error });
    }
});

app.post('/like/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const curretUser = decodedToken.userId;
        const post = await allPostSchema.findById(postId);
        if (!post) {
            return res.json({ message: "Post not found" });
        }
        if (post.likes.includes(curretUser)) {
            const likeCount = post.likes.length;
            return res.json({ message: "You've already liked this post", likeCount: likeCount });
        }
        post.likes.push(curretUser);
        await post.save();
        const likeCount = post.likes.length;
        res.json({ message: "Post liked successfully", likeCount: likeCount, curretUser: curretUser });
    } catch (error) {
        res.json({ message: "Something went wrong", error: error.message });
    }
});

app.post('/unlike/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const curretUser = decodedToken.userId;
        const post = await allPostSchema.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        post.likes = post.likes.filter(id => id.toString() !== curretUser);
        await post.save();
        const likeCount = post.likes.length;
        res.json({ message: "Post unliked successfully", likeCount: likeCount, curretUser: curretUser });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong", error: error.message });
    }
});


app.get('/checkLike/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const curretUser = decodedToken.userId;
        const post = await allPostSchema.findById(postId);
        const likeCount = post.likes.length;
        io.emit('likeView', { likeCount: likeCount })
        res.json({ message: "success", likeCount, totalLikes: post.likes, curretUser: curretUser });
    } catch (error) {
        res.json({ message: "something went wrong", error: error })
    }
})


app.post('/addComment/:postId', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const userId = decodedToken.userId;
        const postId = req.params.postId;
        const text = req.body;
        if (text.data == '') {
            return res.json({ message: "empty field not allowed" })
        }
        const post = await allPostSchema.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        const newComment = new commentSchema({
            user: userId,
            postId: postId,
            comment: text.data
        });
        const savedComment = await newComment.save();
        post.comments.push(savedComment._id);
        await post.save()
        res.status(201).json({ message: "Comment added successfully", comment: savedComment });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong", error: error.message });
    }
});


app.get('/post/viewComments/:postId', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const userId = decodedToken.userId;
        const postId = req.params.postId;
        const post = await allPostSchema.findById(postId).populate('comments')


        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        const comments = post.comments.map(comment => {
            return {
                id: comment._id,
                user: comment.user,
                comment: comment.comment,
                createdAt: comment.createdAt,
                // userName : findUser.user.username
            };
        });
        // const findUser = await commentSchema.find(user)
        console.log(comments, 'userrrrrrrrrrrrrrrrrrrrrrr')
        const commentsOnly = comments.map(comment => ({
            id: comment._id,
            user: comment.user,
            comment: comment.comment
        }));
        io.emit('viewComment', { myComment: commentsOnly })
        res.status(200).json({ commentsOnly: comments });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong", error: error.message });
    }
});


app.post('/addReply/:commentId', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const userId = decodedToken.userId;
        const commentId = req.params.commentId;
        const replyText = req.body;
        const parentComment = await commentSchema.findById(commentId);
        if (!parentComment) {
            return res.json({ message: "Parent comment not found" });
        }
        const newReply = new replySchema({
            user: userId,
            commentId: commentId,
            reply: replyText.data.comment
        });
        const savedReply = await newReply.save();
        parentComment.replies.push(savedReply._id);
        await parentComment.save();
        res.json({ message: "Reply added successfully", reply: savedReply });
    } catch (error) {
        res.json({ message: "Something went wrong", error: error.message });
    }
});

app.get('/viewReply/:commentId', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const userId = decodedToken.userId;
        const commentId = req.params.commentId;
        const parentComment = await commentSchema.findById(commentId).populate('replies')
        if (!parentComment) {
            return res.status(404).json({ message: "Parent comment not found" });
        }
        const replies = parentComment.replies.map(reply => ({
            id: reply._id,
            user: reply.user,
            replyText: reply.reply
        }));
        res.status(200).json({ replies });
    } catch (error) {
        res.json({ message: "something went wrong", error: error })
    }
})

app.get('/userProfile/:id', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const userId = decodedToken.userId;
        const findUser = await userSchema.findOne({ _id: req.params.id })
        res.json({ message: 'success', user: findUser })
    } catch (error) {
        res.json({ message: 'something went wrong', error: error })
    }
})

app.delete('/deleteComment/:commentId', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const userId = decodedToken.userId;
        const commentId = req.params.commentId;


        const comment = await commentSchema.findById(commentId);

        console.log("comment :", comment)

        if (!comment) {
            return res.json({ message: "Comment not found" });
        }

        if (comment.user.toString() !== userId) {
            return res.json({ message: "You cannot delete this comment" });
        }

        await comment.deleteOne();

        await allPostSchema.findByIdAndUpdate(comment.postId, { $pull: { comments: commentId } });


        res.json({ message: "Comment deleted successfully" });
    } catch (error) {
        res.json({ message: "Something went wrong", error: error.message });
    }
});

app.post('/send-message/:receiver', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const userId = decodedToken.userId;
        const receiver = req.params.receiver
        const { message } = req.body;
        const newMessage = new messageSchema({
            sender: userId,
            receiver: receiver,
            message: message
        });
        await newMessage.save();
        res.json({ message: 'Message sent successfully' });
    } catch (error) {
        res.json({ message: 'Failed to send message', error: error.message });
    }
});

app.get('/get-messages/:receiverId', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token, secretKey);
        const senderId = decodedToken.userId;
        const { receiverId } = req.params;
        const userFind = await userSchema.findOne({_id:senderId})
        const messages = await messageSchema.find({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ]
        }).sort({ timestamp: 1 });
        // io.emit('viewMessage', { myMessage: messages })
        res.json({ messages: messages ,currentUser:userFind});
    } catch (error) {
        res.json({ message: 'Failed to retrieve messages', error: error.message });
    }
});

app.get('/all-user',async (req,res) =>{
    try {
        const token = req.headers.authorization;
        const decodedToken = jwt.verify(token,secretKey);
        const userId = decodedToken.userId

        const allUser = await userSchema.find()

        const userDetail = allUser.map(detail => ({
            id:detail._id,
            username:detail.username     
        }))
        res.json({
            message:"SUCCESS",
            allUsers:userDetail
        })
    } catch (error) {
        res.json({message:"something went wrong",error:error.message})
    }
})

app.post('/forgot', async(req,res) =>{
    try {
        // const token = req.headers.authorization;
        // const decodedToken = jwt.verify(token,secretKey);
        // const userId = decodedToken.userId
        const {email} = req.body
        console.log('email',email)
        if(!email){
            return res.json({
                message:"Please enter your Email"
            })
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.json({
                message: "Please enter valid email address"
            })
        }
        const findUser = await userSchema.findOne({email:email})
        console.log("findUser :",findUser.password)
        if(!findUser){
            return res.json({
                message:"We did not find any account associated with this email. Please register yourself first!"
            })
        }

        res.json({
            message:'SUCCESS',
            userInfo:findUser
        })
    } catch (error) {
        res.json({message:"something went wrong",error:error})
    }
})

httpServer.listen(PORT, () => console.log(`listening on port ${PORT}`));