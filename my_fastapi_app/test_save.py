
import requests, json
res = requests.post('http://localhost:8080/api/auth/login', data={'username':'test4@test.com','password':'pw'})
if res.status_code == 200:
    token = res.json().get('access_token')
    res2 = requests.get('http://localhost:8080/api/projects', headers={'Authorization': 'Bearer ' + token})
    projects = res2.json()
    if len(projects) > 0:
        p_id = projects[0]['id']
        payload = {
            'image_path': 'data:image/jpeg;base64,/9j/4AAQ',
            'damages': ['door'],
            'estimates': {'total': '', 'estimates':[{'part':'door', 'cost':''}]}
        }
        res3 = requests.post('http://localhost:8080/api/projects/' + p_id + '/save_analysis', json=payload, headers={'Authorization': 'Bearer ' + token})
        print('Save Analysis STATUS:', res3.status_code)
        print(res3.text)

