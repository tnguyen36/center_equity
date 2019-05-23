var express = require("express");
var app = express();
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var User = require("./models/user");
var Reason = require("./models/reason");
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto");
var environmentVariables = require("dotenv").config();
var { google } = require("googleapis");
var OAuth2 = google.auth.OAuth2;
var moment = require("moment");
var flash = require("connect-flash");
var methodOverride = require("method-override");

// Connect to database
const databaseUri = process.env.MONGODB_URI || "mongodb://localhost:27017/center_equity";
mongoose.connect(databaseUri, {useNewUrlParser: true})
	.then(() => console.log("Database connected"))
	.catch(err => console.log("Database connection error: " + err.message));

// App settings
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname + "/public"));
app.use(methodOverride('_method'));
app.use(flash());

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

app.use(function(req, res, next) {
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	res.locals.moment = moment;
	next();
});


// Root Route
app.get("/", function(req, res) {
	res.render("home");
});



// Register Route
app.get("/register", function(req, res) {
	res.render("register");

});

app.post("/register", function(req, res) {
	var newUser = new User({firstName: req.body.firstName, lastName: req.body.lastName, username: req.body.username, rank: req.body.rank, subscribe: req.body.subscribe, userSince: moment(), lastLogin: moment()});
	User.register(newUser, req.body.password, function(err, user) {
		if (err) {
			console.log(err);
			return res.render("register", {error: err.message});
		}
		Reason.create(req.body.purpose, function(err, reason) {
			if (err) {
				console.log(err);
			} else {
				reason.author.id = user._id;
				reason.author.username = req.body.username;
				reason.save();
				user.reasons.push(reason);
				user.save();
			}
		});
		passport.authenticate("local")(req, res, function() {
			req.flash("success", "You have successfuly registered");
			res.redirect("/");
		});
	});
});

// Login Route
app.get("/login", function(req, res) {
	res.render("login");
});

app.post('/login', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) { 
    	return next(err); 
    }
    if (!user) { 
    	req.flash("error", "Invalid email or password");
    	return res.redirect('/login'); 
    }
    req.logIn(user, function(err) {
    	if (err) { 
    		return next(err); 
    	} else {
    		Reason.create(req.body.purpose, function(err, reason) {
				if (err) {
					console.log(err);
				} else {
					reason.author.id = user._id;
					reason.author.username = req.body.username;
					reason.save();
					user.lastLogin = moment();
					user.reasons.push(reason);
					user.save();
				}
			});
    	}
     	return res.redirect('/');
    });
  })(req, res, next);
});


// app.post("/login", passport.authenticate("local", 
// 	{
// 		successRedirect: "/",
// 		failureRedirect: "/login",
// 		failureFlash: true
// 	}), function(req, res) {
// 		User.findOne({username: req.body.username}, function(err, user) {
// 			if (err) {
// 				console.log(err);
// 			} else {
// 				Reason.create(req.body.purpose, function(err, reason) {
// 					if (err) {
// 						req.flash("error", "Cannot save Reason");
// 						console.log(err);
// 					} else {
// 						reason.author.id = user._id;
// 						reason.author.username = req.body.username;
// 						reason.save();
// 						user.reasons.push(reason);
// 						user.save();
// 					}
// 				});
// 			}
// 		});
// });

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
				req.flash("error", "Emaill does not exist");
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
				req.flash("error", "Failed to send reset link to your email");
				return res.redirect("/login");
			}
			console.log("mail sent");
			done(err, "done");
		});

	}
	], function(err) {
		if (err) return next(err);
		req.flash("success", "A link has been sent to your email for further instructions");
		res.redirect("/forgot");
	});
});
				


// Reset Email Link Route
app.get("/reset/:token", function(req, res) {
	User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: moment() } }, function (err, user) {
	    if (!user) {
	    	req.flash("error", "link is invalid or has expired");
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
	        		req.flash("error", "link is invalid or has expired");
	          		return res.redirect('/forgot');
	        	}
	        	if(req.body.password === req.body.password2) {
	          		user.setPassword(req.body.password, function(err) {
	            		user.resetPasswordToken = undefined;
	            		user.resetPasswordExpires = undefined;

	            		user.save(function(err) {
	               			done(err, user);
	            		});
	          		});
	        	} else {
	        		req.flash("error", "Passwords do not match");
	           		return res.redirect("/reset/" + user.resetPasswordToken);
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
    req.flash("success", "Password reset is complete");
    res.redirect("/");
  });
});

app.get("/stats", function(req, res) {
	async.waterfall([
		function(callback) {
			Reason.aggregate([{$group: {_id:"$text", total: {"$sum":1}}}], function(err, reasons) {
				callback(null, reasons);
			});
		},
		function(reasons, callback) {
			User.aggregate([{$match: {rank: {$not:{$eq: "Admin"}}}},{$group: {_id:"$rank", total: {"$sum":1}}}], function(err, ranks) {
				callback(null, reasons, ranks);
			});
		},
		function(reasons, ranks, callback) {
			User.aggregate([{$match: {rank: {$not:{$eq: "Admin"}}}},{$group: {_id:"$subscribe", total: {"$sum":1}}}], function(err, subscribe) {
				callback(null, reasons, ranks, subscribe);
			});
		},
		function(reasons, ranks, subscribe, callback) {
			User.find({lastLogin: {$gte: moment().startOf("day"), $lt: moment().endOf("day")},rank: {$ne: "Admin"}}, function(err, users) {
				callback(null, reasons, ranks, subscribe, users);
			});
		},
		function(reasons, ranks, subscribe, users, callback) {
			User.find({userSince: {$gte: moment().startOf("day"), $lt: moment().endOf("day")},rank: {$ne: "Admin"}}, function(err, newUsers) {
				callback(null, reasons, ranks, subscribe, users, newUsers);
			});
		},
		function(reasons, ranks, subscribe, users, newUsers, callback) {
			User.find({rank: {$ne: "Admin"}}, function(err, userList) {
				callback(null, reasons, ranks, subscribe, users, newUsers, userList);
			}).collation({locale: "en"}).sort({firstName:1});
		},
		function(reasons, ranks, subscribe, users, newUsers, userList, callback) {
			User.find({subscribe: {$eq: "yes"},rank: {$ne: "Admin"}}, function(err, subscribers) {
				callback(null, reasons, ranks, subscribe, users, newUsers, userList, subscribers);
			});
		}
	], function(err, reasons, ranks, subscribe, users, newUsers, userList, subscribers) {
		if (err) return next(err);
			const userSum = ranks.reduce(function(sum, rank){
			  return sum + rank.total;
			}, 0);
			const loginSum = reasons.reduce(function(sum, reason){
			  return sum + reason.total;
			}, 0);
			res.render("stats", {reasons: reasons, ranks: ranks, subscribe: subscribe, userSum: userSum, loginSum: loginSum, users: users, newUsers: newUsers, userList: userList, subscribers: subscribers});


	});
});

// Delete all Users and their reasons 
app.delete("/deleteUsers", function(req, res) {
	async.waterfall([
		function(callback) {
			User.remove({rank: {$ne: "Admin"}}, function(err, deletedUsers) {
				callback(null);
			});
		},
		function(callback) {
			Reason.remove({}, function(err, deletedReasons) {
				callback(null);
			});
		}
		], function(err) {
			res.redirect("/stats");
	});
});

// Ajax call for getting subscriber list
app.get("/subscribers", function(req, res) {
	User.find({subscribe: {$eq: "yes"}, rank: {$ne: "Admin"}}, function(err, subscribers) {
		if (err) {
			console.log(err);
		} else {
			const emails = subscribers.reduce(function(sum, user) {
				return sum + user.username + ";";
			}, "");
			res.json(emails);
		}
	});
})

// http request listener
app.listen(process.env.PORT,process.env.IP, function() {
	console.log("Server has started!");
});