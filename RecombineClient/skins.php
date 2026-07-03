<?php

// 1430e025b7b12b0bc1a5a7d72bc9a4d0
if ($_FILES['skin']['name'] != "") {
  if ($_POST['password'] == md5('wynell god')) {
    $name = $_POST['name'] ? $_POST['name'] . ".png" : $_FILES['skin']['name'];
    if (preg_match("/^[\w\d\s]+\.png$/", $name)) {
      if ($_POST['delete']) {
        if (unlink("./skins/" . $name)) {
          echo ("Skin deleted");
        } else {
          echo ("Couldn't delete a file");
        }
      } else {
        $pathto = "./skins/" . $name;
        if (move_uploaded_file($_FILES['skin']['tmp_name'], $pathto)) {
          echo ("Skin uploaded");
        } else {
          echo ("Could not copy file");
        }
      }
    }
  } else {
    echo ("Wrong password");
  }
}

?>

<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href='https://fonts.googleapis.com/css?family=Ubuntu:700' rel='stylesheet' type='text/css'>
  <link href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/css/gallery.css" rel="stylesheet">
  <title>Skin list</title>
</head>

<body>
  <form class="form-inline" method="post" enctype="multipart/form-data">
    <div class="form-group">
      <input placeholder="Password:" name="password" />
      <input placeholder="Name:" name="name" />
      <input type="file" name="skin" />
      <input type="submit" name="upload" value="Upload" />
      <input type="submit" name="delete" value="Delete" />
    </div>
  </form>
  <div class="row center">
    <ul>
      <?php
      $dirname = "./skins/";
      $images = scandir($dirname);
      $ignore = array(".");
      foreach ($images as $curimg) {
        if (!in_array($curimg, $ignore) && strtolower(pathinfo($curimg, PATHINFO_EXTENSION)) == "png") {
      ?>
          <li class="skin" data-dismiss="modal">
            <div class="circular" style='background-image: url("./<?php echo $dirname . $curimg ?>")'></div>
            <h4 class="title"><?php echo pathinfo($curimg, PATHINFO_FILENAME); ?></h4>
          </li>
      <?php
        }
      }
      ?>
    </ul>
  </div>
</body>

</html>