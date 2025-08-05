import { useNavigation } from "@react-navigation/native"
import { Button } from "react-native"

export default function GoBackButton(){
    const navigation = useNavigation()
    return (
        <Button title="Go back!" onPress={() => navigation.goBack()}></Button>
    )
}