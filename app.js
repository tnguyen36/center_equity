var express = require("express");
var app = express();
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var User = require("./models/user");
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto");
var environmentVariables = require("dotenv").config();
var { google } = require("googleapis");
var OAuth2 = google.auth.OAuth2;
var moment = require("moment");



// Connect to database
const databaseUri = process.env.MONGODB_URI || "mongodb://localhost:27017/center_equity";
mongoose.connect(databaseUri, {useNewUrlParser: true})
	.then(() => console.log("Database connected"))
	.catch(err => console.log("Database connection error: " + err.message));

// App settings
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname + "/public"));

// Session for storing data
app.use(require("express-session")( {
	secret: "Rusty Wins",
	resave: false,
	saveUninitialized: false
}));

// Initialize passport for user login
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


// Root Route
app.get("/", function(req, res) {
	res.render("home");
});



// Register Route
app.get("/register", function(req, res) {
	res.render("register");

});

app.post("/register", function(req, res) {
	var newUser = new User({firstName: req.body.firstName, lastName: req.body.lastName, username: req.body.username, rank: req.body.rank, reason: req.body.reason, subscribe: req.body.subscribe});
	User.register(newUser, req.body.password, function(err, user) {
		if (err) {
			console.log(err);
			return res.render("register");
		}
		passport.authenticate("local")(req, res, function() {
			res.redirect("/");
		});
	});
});

// Login Route
app.get("/login", function(req, res) {
	res.render("login");
});

app.post("/login", passport.authenticate("local", 
	{
		successRedirect: "/",
		failureRedirect: "/login"
	}), function(req, res) {

});

// Forgot Password Route
app.get("/forgot", function(req, res) {
	res.render("forgot");
});

app.post("/forgot", function(req, res, next) {
	async.waterfall([
		function(done) {
			crypto.randomBytes(20, function(err, buf) {
		        var token = buf.toString('hex');
		        done(err, token);
      });
    },
    function(token, done) {
    	User.findOne({ username: req.body.email}, function(err, user) {
			if(!user) {
				return res.redirect("/forgot");
			}
			user.resetPasswordToken = token;
			user.resetPasswordExpires = moment().add(1,"hour");

			user.save(function(err) {
				done(err, token, user);
			});
		});
    },
	function(token, user, done) {
		var smtpTransport = nodemailer.createTransport({
			service: "Gmail",
			host: "smtp.gmail.com",			
			auth: {
				type: "OAuth2",
				user: process.env.MAIL_ACCOUNT,
				clientId: process.env.CLIENT_ID,
				clientSecret: process.env.CLIENT_SECRET,
				refreshToken: process.env.REFRESH_TOKEN,
				accessToken:  process.env.ACCESS_TOKEN,
			}
		});
		var mailOptions = {
			to: user.username,
			from: "Center Equity <" + process.env.MAIL_ACCOUNT + ">",
			subject: "Password Reset",
			text: "Please click on the following link below, or paste this into your browser to complete the process:\n\n" +
				"http://" + req.headers.host + "/reset/" + token +  "\n\n" +
				"If you did not request this, please ignore this email and your password will remain unchanged"
		};
		smtpTransport.sendMail(mailOptions, function(err) {
			if (err) {
				console.log(err);
				return res.redirect("/login");
			}
			console.log("mail sent");
			done(err, "done");
		});

	}
	], function(err) {
		if (err) return next(err);
		res.redirect("/forgot");
	});
});
				


// Reset Email Link Route
app.get("/reset/:token", function(req, res) {
	User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: moment() } }, function (err, user) {
	    if (!user) {
	      	return res.redirect('/forgot');
	    }	
		res.render("reset", {token: req.params.token});
	});
});

app.post("/reset/:token", function(req, res, next) {
  async.waterfall([
	    function(done) {
	      	User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: moment() } }, function(err, user) {
	        	if (!user) {
	          		return res.redirect('/forgot');
	        	}
	        	if(req.body.password === req.body.confirm) {
	          		user.setPassword(req.body.password, function(err) {
	            		user.resetPasswordToken = undefined;
	            		user.resetPasswordExpires = undefined;

	            		user.save(function(err) {
	               			done(err, user);
	            		});
	          		});
	        	} else {
	           		return res.redirect('/login');
	        	}
	      	});
    	}
    // function(user, done) {
    //   var smtpTransport = nodemailer.createTransport({
    //     service: 'Gmail', 
    //     auth: {
    //       user: process.env.MAIL_ACCOUNT,
    //       pass: process.env.MAIL_PW
    //     }
    //   });
    //   var mailOptions = {
    //     to: user.username,
    //     from: process.env.MAIL_ACCOUNT,
    //     subject: 'Your password has been changed',
    //     text: 'Hello,\n\n' +
    //       'This is a confirmation that the password for your account ' + user.username + ' has just been changed.\n'
    //   };
    //   smtpTransport.sendMail(mailOptions, function(err) {
    //     done(err);
    //   });
    // }
  ], function(err) {
    if (err) return next(err);
    res.redirect("/");
  });
});

// http request listener
app.listen(process.env.PORT, process.env.IP, function() {
	console.log("Server has started!");
});