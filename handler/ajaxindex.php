<?php

    //должен возвращаться json и среди данных есть message: "success" (если запрос успешный)
    header("Content-type: application/json");
    echo json_encode(["message" => "success", "data" => $_POST]);

?>