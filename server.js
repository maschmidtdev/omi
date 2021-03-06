const express     = require('express')
const app         = require('express')();
const port 		    = process.env.PORT || 4443
const http        = require('http').createServer(app);
const io          = require('socket.io')(http);
const fs          = require('fs');
const ldap 		    = require('ldapjs');
const uuid        = require('uuid/v4'); // Random strings
const session     = require('client-sessions');
const bodyParser  = require('body-parser');
const mariadb     = require('mariadb');


// ===========================================
// ============= Database Config =============
// ===========================================

var pool = null; // Saving db connection later by db.conf

fs.access("db.conf", fs.constants.F_OK, err => {
  if(err){
    console.log(err);
    console.log('No "db.conf" file found! Exiting Process.');
    process.exit(1); // Abort server if file is missing
  } else {
    // Read content of db.conf
    fs.readFile("db.conf", "utf8", (err, data) => {

      if(!err){
        var dbconf = data.split("\n"); // Split config data into lines

        // Get db config data from the right side of "="
        var host = dbconf[0].split("="); host = host[1];
        var user = dbconf[1].split("="); user = user[1];
        var password = dbconf[2].split("="); password = password[1];
        var database = dbconf[3].split("="); database = database[1];

        // Establish mariaDB connection with config data
        pool = mariadb.createPool({
          host: host,
          user: user,
          password: password,
          database: database
        });

      } else {
        console.log(err);
        console.log('Exiting Process.');
        process.exit(1);
      }
    });
  }
});


// ===========================================
// =========== Express Middleware ============
// ===========================================
app.set('views', './views');
app.set('view engine', 'pug');

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(session({
  cookieName: 'session',
  secret: 'thisismylifenow',
  duration: 30 * 60 * 1000, // min * sec * milsec
  activeDuration: 5 * 60 * 1000,
  httpOnly: true,
  secure: true,
  ephemeral: true
}));


// ===========================================
// ======== LDAP Connection Settings =========
// ===========================================

const server = "dc-hh-01.ors.local"; // 192.168.1.1
const adSuffix = "dc=ors,dc=local"; // ors.local
var userPrincipalName = null; // Set later by auth.conf
var password = null; // Set later by auth.conf

const ldap_client_setting = {
  url: `ldap://${server}`,
  //connectTimeout: 0, // Milliseconds client should wait before timing out on TCP connections (Default: OS default)
  reconnect: true
}


// Create the admin client
const admin_client = ldap.createClient(ldap_client_setting);




// Check if auth.txt exists
fs.access("auth.conf", fs.constants.F_OK, err => {
  if(err){
    console.log(err);
    console.log('No auth.txt file found! Exiting Process.');
    process.exit(1); // Abort server if file is missing
  } else {
    // Read content of auth.txt
    fs.readFile("auth.conf", "utf8", (err, data) => {

      if(!err){
        // Get AD admin credentials for binding admin_client
        var authconf = data.split("\n");
        userPrincipalName = authconf[0].split("="); userPrincipalName = userPrincipalName[1]; // omiadmin@ors.local
        password = authconf[1].split("="); password = password[1];
      } else {
        console.log(err);
        console.log('Exiting Process.');
        process.exit(1);
      }
    });
  }
});


// ===========================================
// ================ Routing ==================
// ===========================================

// Land on login page
app.get('/', function(req, res){
  if(req.session.role == 'admin'){
    res.render('admin', {user: req.session.user});
  }else if(req.session.user){
    res.redirect('/index');
  }else{
    res.render('login');
  }
});

// Attempt login
app.post('/', function(req, res) {

  var upn = req.body.user + '@ors.local'; // userPrincipalName
  var password = req.body.password;

  // Create user client
  var user_client = ldap.createClient({
    url: `ldap://${server}`
  });

  // Bind client to a user to authenticate
  user_client.bind(upn, password, (err) => {
    if(err || password === ''){ // user not authenticated
      console.log('ERROR: ' + err);
      res.redirect('/');
      return;
    } else { // user is authenticated via ldap
      console.log('User Authenticated!');
      req.session.user = req.body.user;
      delete req.body.password;
      user_client.destroy(); // probably won't be used again

      // Get matching mariaDB user next
      var query = "SELECT * FROM users WHERE username = '" + req.session.user + "';";

      genericQuery(query, (result) => {
        req.session.role = result[0].role; // Assign the user's role to the session
        res.redirect('/admin'); // Will redirect to /index if not admin
      });

    }
  });

});

// Logout
app.get('/logout', function(req, res) {
  req.session.reset(); // Clear session data
  res.redirect('/'); // Back to login page
});

// Get index page if logged in
app.get('/index', function(req, res){
  if(req.session.user){ // logge{d in?
    res.render('index', {user: req.session.user});
  } else { // If user not logged in
    res.redirect('/'); // Back to login page
  }
});

// Get admin page if logged in
app.get('/admin', function(req, res){
  if(req.session.role == 'admin'){ // Logged in as admin?
    res.render('admin', {user: req.session.user});
  } else {
    res.redirect('/'); // Back to login page
  }
});

// Get users page if logged in
app.get('/users', function(req, res){
  if(req.session.role == 'admin'){ // logged in as admin?
    res.render('users', {user: req.session.user});
  } else {
    res.redirect('/'); // Back to login page
  }
});

// Get roles page if logged in
app.get('/roles', function(req, res){
  if(req.session.role == 'admin'){ // logged in as admin?
    res.render('roles', {user: req.session.user});
  } else {
    res.redirect('/'); // Back to login page
  }
});


// ===========================================
// ============ Socket Handling  =============
// ===========================================

io.on('connection', function(socket){
  console.log('A user connected!');

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

  socket.on('get_ad_user_object', (data) => {
    searchADUser(data.user + '@ors.local', socket, (result) => {
      if(result.status === 'user found'){
        // socket.emit('ldap_user_search_result', {object: result.object});
        socket.emit('ad_user_object', {
          userObjectString: JSON.stringify(result.object, undefined, 1),
          userObject: result.object,
          username: data.user
        });

      } else if (result.status === 'user not found'){
        socket.emit('alertmessage', {msg: 'user not found'});
      }
    });
  });

  socket.on('ldap_search_user', (data) => {

    searchADUser(data.search + '@ors.local', socket, (result) => {
      if(result.status === 'user found'){
        socket.emit('ldap_user_search_result', {object: result.object});
      } else if (result.status === 'user not found'){
        socket.emit('alertmessage', {msg: 'user not found'});
      }
    });
  });

  socket.on('ldap_add_user', () => {

    var newDN = "CN=omi test,OU=Admins,OU=Orendt Studios Holding,DC=ORS,DC=local";
    var newUser = {
      cn: 'omi test',
      sn: 'test',
      mail: 'omitest@orendtstudios.com',
      objectclass: ['top','person','organizationalPerson','user'],
      distinguishedName: 'CN=omi test,OU=Admins,OU=Orendt Studios Holding,DC=ORS,DC=local',
      userPrincipalName: 'omitest@ors.local',
      sAMAccountName: 'omitest',
      title: "OMI Test account",
      description: 'user created at blahblahblah',
      telephoneNumber: '123123',
      givenName: 'omi',
      displayName: 'omitest',
      info: 'user added',
      company: 'Orendt',
      division: 'hostname',
      userPassword: 'dummespasswort'
    };

    admin_client.bind(userPrincipalName, password, function(err){
      if(err){
        console.log('ERROR: ' + err);
        return;
      } else {
        console.log('Admin Authenticated!');
        admin_client.add(newDN, newUser, (err) => {
          if(err){
            console.log('ERROR: ' + err);
            socket.emit('alertmessage', {msg: 'Error: ' + JSON.stringify(err, undefined, 1)});
            admin_client.unbind(); // Unbind to not get ECONNRESET error
          } else {
            console.log('Success: Created user ' + newUser['sAMAccountName'] + '!');
            socket.emit('alertmessage', {msg: 'Success: Created user ' + newUser['sAMAccountName']});
            admin_client.unbind(); // Unbind to not get ECONNRESET error
          }
        });
      }
    });

  });

  socket.on('ldap_new_user_check', (data) => {
    searchADUser(data.first_name+data.last_name+'@ors.local', socket, (result) => {
      if(result.status === 'user found'){
        // Create new DB user
        var username = data.first_name+data.last_name;
        var role = data.role;
        var email = data.first_name.charAt(0)+"."+data.last_name+"@orendtstudios.com";
        var query = "INSERT INTO users (username, role, email) VALUES ('"+username+"', '"+role+"', '"+email+"');";

        genericQuery(query, (result) => {
          socket.emit('db_user_added');
        });

      } else if (result.status === 'user not found'){
        socket.emit('alertmessage', {msg: 'Dieser User existiert nicht im AD!'});

        // Add code for creating new AD user later

        // admin_client.bind(userPrincipalName, password, function(err){
        //   if(err){
        //     console.log('ERROR: ' + err);
        //     return;
        //   } else {
        //     console.log('Admin Authenticated!');
        //     admin_client.add(newDN, newUser, (err) => {
        //       if(err){
        //         console.log('ERROR: ' + err);
        //         socket.emit('alertmessage', {msg: 'Error: ' + JSON.stringify(err, undefined, 1)});
        //         admin_client.unbind(); // Unbind to not get ECONNRESET error
        //       } else {
        //         console.log('Success: Created user ' + newUser['sAMAccountName'] + '!');
        //         socket.emit('alertmessage', {msg: 'Success: Created user ' + newUser['sAMAccountName']});
        //         admin_client.unbind(); // Unbind to not get ECONNRESET error
        //       }
        //     });
        //   }
        // });


      }
    });
  });

  socket.on('ldap_delete_user', (data) => {
    var dn = data.dn; // distinguishedName
    deleteAdUser(dn, socket);
  });

  socket.on('get_db_users', () => {

    var query = "SELECT * FROM users";

    genericQuery(query, (result) => {
      console.log(result);
      socket.emit('db_users', {users: result});
    });

  });

  socket.on('get_db_roles', () => {

    var query = "SELECT * FROM roles;"

    genericQuery(query, (result) => {
      console.log(result);
      socket.emit('db_roles', {result: result});
    });
  });

  socket.on('add_role', (data) => {

    var new_role = data.role;
    var query = "INSERT INTO roles (role_name) VALUES ('"+new_role+"');";

    genericQuery(query, (result) => {
      socket.emit('db_role_added', {role: new_role});
    });
  });

  socket.on('delete_role', (data) => {

    var query = "DELETE FROM roles WHERE role_name ='"+data.role+"';";

    genericQuery(query, (result) => {
      socket.emit('db_role_deleted', {role: data.role});
    });
  });

  socket.on('db_delete_user', (data) => {

    var query = "DELETE FROM users WHERE username = '"+data.username+"';";

    genericQuery(query, (result) => {
      socket.emit('db_user_deleted');
    });

  });

  socket.on('ldap_groups', () => {

    var searchOptions = {
  	    scope: 'sub',
  	};

    ad_groups = [];

    // First bind admin_client
    var admin_client = ldap.createClient(ldap_client_setting);
    admin_client.bind(userPrincipalName, password, function(err){
      if(err){
        console.log('ERROR: ' + err);
        return;
      } else {
        console.log('Admin Authenticated!');
        // Then perform search
        admin_client.search('ou=Gruppen, ou=Orendt, '+adSuffix, searchOptions, (err, res) => {
          if(err){
            console.log('Error occured while ldap search:');
            console.log(err);
          }
          res.on('searchEntry', entry => {
            // The 'searchEntry' event doesn't fire if we don't find a user, so we don't get notified if the search fails
            // So we save the result into a helper var and check against it in another event that always fires -> 'end'
            last_ = entry; // Found entry, save it
            console.log('SEARCH ENTRY');
            ad_groups.push(entry);
            console.log(entry);
          });
          res.on('searchReference', referral => {
            console.log('referral: ' + referral.uris.join());
          });
          res.on('error', err => {
            console.error('error: ' + err.message);
            socket.emit('alertmessage', {msg: err.message});
          });
          res.on('end', result => {
            // Here we check if the suer we searched for matches the last saved user entry from the 'searchEntry' event
            // But first we check if we had saved any object at all so far:

            ad_groups.forEach( (e) => {
              console.log(e.objectName);
            })

            // if(last_entry.object && upn === last_entry.object.sAMAccountName + '@ors.local'){
            //   console.log('entry: ' + JSON.stringify(last_entry.object, undefined, 1));;
            //   cb({status: 'user found', object: last_entry.object})
            // } else {
            //   cb({status: 'user not found'});
            // }

            admin_client.unbind(); // Unbind to not get ECONNRESET error
          });
        });
      }
    });

  });

});


// ===========================================
// ============== Helper Vars  ===============
// ===========================================

var last_entry = ''; // Saves the last found AD user
var ad_groups = ''; // Saves the last found AD groups


// ===========================================
// =============== Functions  ================
// ===========================================

searchADUser = function(upn, socket, cb) {
	var searchOptions = {
	    scope: 'sub',
	    filter: `(userPrincipalName=${upn})`
	};

  // First bind admin_client
  var admin_client = ldap.createClient(ldap_client_setting);
  admin_client.bind(userPrincipalName, password, function(err){
    if(err){
      console.log('ERROR: ' + err);
      return;
    } else {
      console.log('Admin Authenticated!');
      // Then perform search
      admin_client.search(adSuffix, searchOptions, (err, res) => {
        if(err){
          console.log('Error occured while ldap search:');
          console.log(err);
        }
      	res.on('searchEntry', entry => {
          // The 'searchEntry' event doesn't fire if we don't find a user, so we don't get notified if the search fails
          // So we save the result into a helper var and check against it in another event that always fires -> 'end'
          last_entry = entry; // Found entry, save it
      	});
      	res.on('searchReference', referral => {
      		console.log('referral: ' + referral.uris.join());
      	});
      	res.on('error', err => {
      		console.error('error: ' + err.message);
          socket.emit('alertmessage', {msg: err.message});
      	});
      	res.on('end', result => {
          // Here we check if the suer we searched for matches the last saved user entry from the 'searchEntry' event
          // But first we check if we had saved any object at all so far:
          if(last_entry.object && upn === last_entry.object.sAMAccountName + '@ors.local'){
        		console.log('entry: ' + JSON.stringify(last_entry.object, undefined, 1));;
            cb({status: 'user found', object: last_entry.object})
          } else {
            cb({status: 'user not found'});
          }

          admin_client.unbind(); // Unbind to not get ECONNRESET error
      	});
      });
    }
  });
}

deleteAdUser = function(dn, socket){

  // First bind admin_client
  var admin_client = ldap.createClient(ldap_client_setting);
  admin_client.bind(userPrincipalName, password, function(err){
    if(err){
      console.log('ERROR: ' + err);
      return;
    } else {
      console.log('Admin Authenticated!');
      admin_client.del(dn, (err) => {
        if(err){
          console.log('ERROR: ' + err);
          socket.emit('alertmessage', {msg: 'Error: ' + JSON.stringify(err, undefined, 1)});
          admin_client.unbind(); // Unbind to not get ECONNRESET error
        } else {
          console.log('Success: Deleted user ' + dn + '!');
          socket.emit('alertmessage', {msg: 'Success: Deleted user ' + dn + '.'} );
          admin_client.unbind(); // Unbind to not get ECONNRESET error
        }
      });
    }
  });

}


// ===========================================
// ================ Queries  =================
// ===========================================

genericQuery = function(query, cb){

  pool.getConnection().then(conn => {

    conn.query(query).then((rows) => {
      console.log(rows);
      cb(rows); // Callback: redirect to /index
      conn.end();
    })
    // .then((res) => {
    //   console.log('res:');
    //   console.log(res);
    // })
    .catch(err => {
      // Handle error
      console.log('error');
      console.log(err);
      conn.end();
    })

  }).catch(err => {
    console.log('db error: ' + err);
  });
}


// ===========================================
// ============== Start Server  ==============
// ===========================================

http.listen(port, function(){
  console.log('listening on *:' + port);
});
