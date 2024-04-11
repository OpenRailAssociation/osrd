use serde::Deserialize;
use std::{fs::File, io::BufReader};

uniffi::setup_scaffolding!();

#[derive(uniffi::Record, Deserialize)]
pub struct Person {
    name: String,
    surname: String,
}

#[derive(uniffi::Record, Deserialize, PartialEq, Debug)]
pub struct Greetings {
    formal: String,
    informal: String,
}

#[uniffi::export]
pub fn make_greeting(person: &Person) -> Greetings {
    Greetings {
        formal: format!("Hello, {} {}!", person.name, person.surname),
        informal: format!("Hi, {}!", person.name),
    }
}

// =========================================================================================================
// These are used for tests both in rust and kotlin. Maybe we could mark them with #[cfg(test)]
// but then we'd need to specifically build the debug version of the library for testing on the kotlin side.

#[derive(Debug, thiserror::Error, uniffi::Error)]
pub enum TrainSimFromFileError {
    #[error("Could not open file at path: {file_path} due to:\n {reason}")]
    OpeningFileError { file_path: String, reason: String },
    #[error("Could not deserialize file at path: {file_path} due to:\n {reason}")]
    DeserializingError { file_path: String, reason: String },
}

impl TrainSimFromFileError {
    pub fn new_opening_file_error(file_path: String, reason: String) -> Self {
        TrainSimFromFileError::OpeningFileError { file_path, reason }
    }

    pub fn new_deserializing_error(file_path: String, reason: String) -> Self {
        TrainSimFromFileError::DeserializingError { file_path, reason }
    }
}

pub fn deserialize_from_file<T>(file_path: String) -> Result<T, TrainSimFromFileError>
where
    T: for<'de> Deserialize<'de>,
{
    let file = File::open(file_path.clone()).map_err(|e| {
        TrainSimFromFileError::new_opening_file_error(file_path.clone(), e.to_string())
    })?;
    let reader = BufReader::new(file);
    let t = serde_json::from_reader(reader)
        .map_err(|e| TrainSimFromFileError::new_deserializing_error(file_path, e.to_string()))?;
    Ok(t)
}

#[uniffi::export]
pub fn person_from_json_file(file_path: String) -> Result<Person, TrainSimFromFileError> {
    deserialize_from_file(file_path)
}

#[uniffi::export]
pub fn greetings_from_json_file(file_path: String) -> Result<Greetings, TrainSimFromFileError> {
    deserialize_from_file(file_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_make_greeting() {
        let person = Person {
            name: "John".to_string(),
            surname: "Doe".to_string(),
        };
        assert_eq!(
            make_greeting(&person),
            Greetings {
                formal: "Hello, John Doe!".to_string(),
                informal: "Hi, John!".to_string(),
            }
        );
    }

    macro_rules! test_file {
        ($fname:expr) => {
            concat!(env!("CARGO_MANIFEST_DIR"), "/cross_language_tests/", $fname)
        };
    }

    #[test]
    fn test_cross_language() {
        let person_path = test_file!("input.json");
        let person = person_from_json_file(person_path.to_string()).unwrap();

        let greetings_path = test_file!("expected_output.json");
        let greetings = greetings_from_json_file(greetings_path.to_string()).unwrap();

        assert_eq!(make_greeting(&person), greetings);
    }
}
