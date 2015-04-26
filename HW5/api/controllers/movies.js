var request = require("request");
var Usergrid = require("usergrid");
var async = require("async");

module.exports = {
	getMovies: getMovies,
	getMovieByUUID: getMovieByUUID,
	postMovie: postMovie,
	deleteMovie: deleteMovie,
	postReview: postReview
}

//Return all movie titles, release dates, and actors
function getMovies (req, res) {
	//Request the collection
	request("http://api.usergrid.com/leikamt/sandbox/movies", function (err, response, body) {
		if (err) {
			res.send(err);
		}
		else {
			//Parse the data returned into easy to read json
			body = JSON.parse(body);
			body = body.entities;
			
			//Will be used to extract just the title, release date, and actor array
			var movie_list = [];
			var movie = {};
			
			for(i = 0; i < body.length; i++) {
				//Create a new JSON for the movie in body, and get its title, release date, and actor array
				movie = {uuid:body[i].uuid, title:body[i].title, releaseDate:body[i].releaseDate, actors:body[i].actors};
				
				//Push the new movie JSON into an array that will be returned
				movie_list.push(movie);
			}
			
			//Return the movie array that contains only titles, release dates, and actors
			res.send(movie_list);
		}
	});
}

//Get a specific movie for the uuid sent in, and return its title, release date, and actors.
//If the user wants reviews, return each review (containing its author, body, and rating) as
//well as the average of the reviews
function getMovieByUUID (req, res) {
	var uuid = req.swagger.params.uuid.value;
	var reviews = req.swagger.params.reviews.value;
	
	//If the user doesn't want reviews then just return the movie
	if(reviews != 'true') {
		request("http://api.usergrid.com/leikamt/sandbox/movies?ql=uuid=" + uuid, function(err, response, body) {
			if (err) {
				res.send(err);
			}
			else {
				body = JSON.parse(body);
				body = body.entities;
			
				var movie = {uuid:body[0].uuid, title:body[0].title, releaseDate:body[0].releaseDate, actors:body[0].actors};
			
				res.send(movie);
			}
		});
	}
	//Otherwise, use async to get the movie and its reviews at the same time.
	else {
		async.parallel({
		//Get the movie
		movies: function (callback) {
			request("http://api.usergrid.com/leikamt/sandbox/movies?ql=uuid=" + uuid, function(err, response, body) {
				if (err) {
					res.send(err);
				}
				else {
					body = JSON.parse(body);
					body = body.entities;
			
					var movie = {uuid:body[0].uuid, title:body[0].title, releaseDate:body[0].releaseDate, actors:body[0].actors};
			
					callback(null, movie);
				}
			});
		},
		//Get the reviews
		moviereviews: function (callback) {
			async.waterfall([
					function (callback) {
						request('http://api.usergrid.com/leikamt/sandbox/moviereviews?ql=movieuuid=' + uuid, function(err, response, body) {
							if(err) {
								res.send(err);
							} 
							else {
								body = JSON.parse(body);
								body = body.entities;
								
								var review_list = [];
								var review = {};
			
								for(i = 0; i < body.length; i++) {
									//Create a new JSON for the review in body, and get its author, body, and rating
									review = {author:body[i].author, body:body[i].body, rating:body[i].rating};
				
									//Push the new review JSON into an array that will be returned
									review_list.push(review);
								}
								
								callback(null, review_list);
							}
						});
					},
					//Calculate the review average
					function (review_list, callback) {
						var l = review_list.length;
						var aggregate = 0;
						var i;
						for (i = 0; i < l; i++) {
							aggregate += review_list[i].rating;
						}
						aggregate = {
							aggregate: +(aggregate / i).toFixed(2)
						};
						callback(null, review_list, aggregate);
					}
				], callback);
			
		}
		//Return the movie, its reviews, and the review average
		}, function (err, results) {
			res.send(results);
		});
	}
}

//Using header variables, post a new movie to the collection
function postMovie (req, res) {
	var title = req.swagger.params.title.value;
	var releaseDate = req.swagger.params.releaseDate.value;
	var a1 = req.swagger.params.a1.value;
	var a2 = req.swagger.params.a2.value;
	var a3 = req.swagger.params.a3.value;
	
	var dataClient = new Usergrid.client({
		orgName:'leikamt',
		appName:'sandbox'
	});
	
	var properties = {
		type: "movies",
		title: title,
		releaseDate: releaseDate,
		actors: [
			{
				name: a1
			},
			{
				name: a2
			},
			{
				name: a3
			}
		]
	}
	
	if(title == undefined || releaseDate == undefined || a1 == undefined
		|| a2 == undefined || a3 == undefined) {
			res.send("Error, not all data has values!");
	}
	
	dataClient.createEntity(properties, function (err, result) {
		if(err) {
			res.send("Error, could not create movie!");
		}
		else {
			res.send("Movie successfully added!  ");
		}
	});
}

//Delete the movie with the uuid that was passed in
function deleteMovie (req, res) {
	var uuid = req.swagger.params.uuid.value;
	
	var dataClient = new Usergrid.client({
		orgName:'leikamt',
		appName:'sandbox'
	});
	
	var properties = {
		client:dataClient,
		data:{
			'type':'movies',
			'uuid':uuid
		}
	};
	
	var entity = new Usergrid.entity(properties);
	
	entity.destroy(function (err, result) {
		if(err) {
			res.send(err);
		}
		else {
			res.send("Movie with uuid=" + uuid + " has been deleted!");
		}
	});
}

//Post a review for a movie with the uuid that was passed in
function postReview (req, res) {
	var uuid = req.swagger.params.uuid.value;
	var author = req.swagger.params.author.value;
	var body = req.swagger.params.body.value;
	var rating = req.swagger.params.rating.value;
	
	var dataClient = new Usergrid.client({
		orgName:'leikamt',
		appName:'sandbox'
	});
	
	if(author == undefined || body == undefined || rating == undefined) {
		res.send("Error, not all data has values!");
	}
	
	//Rating is based out of 5 stars
	if(rating < 0 || rating > 5) {
		res.send("Error, rating not based out of 5 stars!");
		return
	}
	
	var properties = {
		type: "moviereviews",
		author: author,
		body: body,
		rating: rating,
		movieuuid: uuid
	}
	
	dataClient.createEntity(properties, function (err, result) {
		if(err) {
			res.send("Error, could not create review!");
		}
		else {
			res.send("Review successfully added!");
		}
	});
}