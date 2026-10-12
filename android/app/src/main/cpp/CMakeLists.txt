cmake_minimum_required(VERSION 3.10.2)

project("wabotservice")

# 1. Daftarkan shared library libnode.so yang sudah terkompilasi
add_library(
        node
        SHARED
        IMPORTED)

set_target_properties(
        node
        PROPERTIES IMPORTED_LOCATION
        ${CMAKE_CURRENT_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}/libnode.so)

# 2. Bangun jni bridge native-lib
add_library(
        native-lib
        SHARED
        native-lib.cpp)

# 3. Hubungkan native-lib dengan libnode dan android log
target_link_libraries(
        native-lib
        node
        log)
