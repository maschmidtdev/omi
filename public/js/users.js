$(document).ready(function() {

var socket = io();
var user = $('#user').text(); // Get logged-in user
var users = null; // AD users

socket.emit('get_ad_user_object', {user: user}); // Request the AD User Object in JSON format
socket.emit('get_db_users');
// ========== Socket handling ===========

// Receive the AD User Object and populate DOM elements with data
socket.on('ad_user_object', (data) => {

  // First call of ad_user_object
  if(users === null){
    // Mark 'users' as array to fill with user ad users
    users = [];

    $('#givenName').text('Hallo ' + data.userObject["givenName"] + ', du bist ein Admin! Cool!');
    $('#userObject').text(data.userObject["dn"]);
    $('#userObjectString').text(data.userObjectString);

  // Subsequent calls to populate user list with ad user objects
  } else {
    users[data.username] = [];
    users[data.username].push(data.userObject);
  }
});

// Populate ul/collection with database users
socket.on('db_users', (data) => {

  data.users.forEach((user) => {
    // Request the ad object for the user to save in the users array
    socket.emit('get_ad_user_object', {user: user.username});
    var username = user.username; var role = user.role; var email = user.email;

    // Append user data to the collection
    $('#user-list').append('<li id="user_'+username+'" class="collection-item">'
                            + '<div>'+ username + ' | ' + role + ' | ' + email
                              + '<a id="delete_'+username+'" name="'+username+'" class="secondary-content delete">'
                                + '<i class="material-icons red-text">delete_forever</i>'
                              + '</a>'
                              + '<a id="edit_'+username+'" name="'+username+'" class="secondary-content edit-user">'
                                + '<i class="material-icons">edit</i>'
                              + '</a>'
                              + '<a id="show_'+username+'" name="'+username+'" class="secondary-content show-user">'
                                + '<i class="material-icons">add</i>'
                              + '</a>'
                            + '</div>'
                          + '</li>');
  });

  // Click on delete icon
  $('.delete').click( (event) => {
    var name = $(event.currentTarget).attr("name");

    if(confirm('User ' + name + ' wirklich löschen?')){
      socket.emit('db_delete_user', {username: name});
    } else {
      //
    }
  });

  // Click on edit icon
  $('.show-user').click( (event) => {

    var username = $(event.currentTarget).attr("name");
    var user = users[username][0]; // This is the AD object

    // Delete user details from DOM if exists, else append the information to the corresponding li element
    if($('#userdata_'+username).length != 0){

      $('#show_'+username).find(':first-child').text('add');
      $('#userdata_'+username).remove();

    } else {

      $('#show_'+username).find(':first-child').text('remove');

      // Gather relevant information
      var email = '';
      if(user.proxyAddresses !== undefined){
        email = user.proxyAddresses.replace('SMTP:','').toLowerCase();
      }
      var first_name = user.givenName;
      var last_name = user.sn;

      // Append AD user information to collection item
      $('#user_'+username).append('<div id="userdata_'+username+'">'
                                  + '<p>'
                                    + '<span class="thick">Vorname: </span><span class="secondary-content">'+first_name+'</span><br>'
                                    + '<span class="thick">Nachname: </span><span class="secondary-content">'+last_name+'</span><br>'
                                    + '<span class="thick">E-mail: </span><span class="secondary-content">'+email+'</span><br>'
                                  + '</p>'
                                + '</div>');

      console.log(user);
    }


  });

});

// Populate dropdown-ul with user roles
socket.on('db_roles', (data) => {
  data.result.forEach((role) => {
    $('#dropdown_roles').append('<li><a class="dropdown-item">'+role.role_name+'</a></li>');
  });

  $('.dropdown-trigger').dropdown();
  $('.dropdown-item').on('click', (event) => {
    $('#new_user_role').val(event.target.innerText);
  });

});

socket.on('alertmessage', (data) => {
  alert(data.msg);
});

socket.on('ldap_user_search_result', (data) => {
  alert(JSON.stringify(data.object, undefined, 1));
});

// User added, update view
socket.on('db_user_added', () => {
  updateUserList();
});

// User deleted, update view
socket.on('db_user_deleted', () => {
  updateUserList();
});


// ========== jQuery ===========

$('#scaleNewUserForm').click( () => {

  $('#newUserForm').removeClass('scale-out');

  // Check if the user form already exists
  if ( $('#userFormDiv').children().length > 0 ) {
    removeUserForm();
  } else {
    // Add the list for roles dropdown
    $("body").prepend('<ul id="dropdown_roles" class="dropdown-content"></ul>');
    // Pull roles from db to populate role dropdown
    socket.emit('get_db_roles');

    // Add user form and scale in
    $('#userFormDiv').append('<form class="col s12 scale-transition scale-out" id="newUserForm">'
                              + '<div class="row">'
                                + '<div class="input-field col s6">'
                                  + '<input type="text" class="validate" id="first_name">'
                                  + '<label for="first_name">Vorname</label>'
                                + '</div>'
                                + '<div class="input-field col s6">'
                                  + '<input type="text" class="validate" id="last_name">'
                                  + '<label for="last_name">Nachname</label>'
                                + '</div>'
                              + '</div>'
                              + '<div class="row">'
                                + '<div class="input-field col s5">'
                                  + '<input type="text" class="validate dropdown-trigger" data-target="dropdown_roles" id="new_user_role">'
                                  + '<label for="new_user_role">Role</label>'
                                + '</div>'
                                + '<div class="input-field col s4">'
                                  + '<a id="add_new_user" class="btn">Add User</a>'
                                + '</div>'
                              + '</div>'
                            + '</form>');

    // Give time for fade-in
    setTimeout(() => {
      $('#newUserForm').removeClass('scale-out');
      $('.dropdown-trigger').dropdown();
    }, 30);

    // Click the + button to show form for new user
    $('#add_new_user').click( () => {
      var first_name = $('#first_name').val();
      var last_name = $('#last_name').val();
      var new_user_role = $('#new_user_role').val();

      socket.emit('ldap_new_user_check', {username: (first_name+last_name).toLowerCase(), role: new_user_role});

    });
    // Change icon to -
    $('#scaleNewUserForm').find(':first-child').text('remove');

  }

});

// ========== Functions ===========

updateUserList = function(){
  removeUserForm();
  $('#user-list li').not(':first').remove();
  socket.emit('get_db_users');
}

removeUserForm = function(){
  // Scale out and remove user form
  setTimeout(() => {
    $('#userFormDiv').find(':first-child').remove();
  }, 150);
  // Change icon to +
  $('#scaleNewUserForm').find(':first-child').text('add');
  $('#newUserForm').addClass('scale-out');
}


});
