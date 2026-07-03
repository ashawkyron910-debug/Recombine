<?php

header("Content-Type: image/png");
header("Access-Control-Allow-Origin: *");
echo file_get_contents($_GET['url']);