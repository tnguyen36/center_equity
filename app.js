var express = require("express");
var app = express();
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var User = require("./models/user");

const databaseUri = process.env.MONGODB_URI || "mongodb://localhost:27017/center_equity";
mongoose.connect(databaseUri, {useNewUrlParser: true})
	.then(() => console.log("Database connected"))
	.catch(err => console.log("Database connection error: " + err.message));

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname + "/public"));

app.use(require("express-session")( {
	secret: "Rusty Wins",
	resave: false,
	saveUninitialized: false
}));

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

app.listen(process.env.PORT, process.env.IP, function() {
	console.log("Server has started!");
});